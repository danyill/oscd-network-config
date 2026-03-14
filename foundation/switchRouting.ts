import type { SubscribedTrafficEntry } from './sclTraffic.js';

export type SwitchLink = {
  sourceSwitch: string;
  sourcePort: string;
  targetSwitch: string;
  targetPort: string;
};

export type PortDataEntry = {
  switchName: string;
  iedName: string;
};

export type RoutingEdge = {
  source: string;
  target: string;
};

export const getUndirectedEdgeKey = (a: string, b: string) =>
  [a, b].sort((x, y) => x.localeCompare(y)).join('::');

const findSwitchPath = (
  start: string,
  end: string,
  adjacency: Map<string, Set<string>>
): string[] => {
  if (start === end) return [start];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current === end) {
      // Build path via push+reverse: O(n) vs repeated unshift which is O(n²).
      const path: string[] = [];
      let node: string | undefined = end;
      while (node !== undefined) {
        path.push(node);
        node = parent.get(node);
      }
      return path.reverse();
    }

    const neighbors = adjacency.get(current) ?? new Set();
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    });
  }

  return [];
};

export function buildSubscriptionEdgeVlanMap(args: {
  switchLinks: SwitchLink[];
  portData: PortDataEntry[];
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
}): Map<string, Set<number>> {
  const {
    switchLinks,
    portData,
    publishedTrafficByIed,
    subscribedTrafficByIed
  } = args;

  // Map IED names to attached switches for path finding.
  const iedToSwitch = new Map<string, string>();
  portData.forEach(port => {
    const switchName = port.switchName?.trim() ?? '';
    const iedName = port.iedName?.trim() ?? '';
    if (switchName !== '' && iedName !== '') {
      iedToSwitch.set(iedName, switchName);
    }
  });

  // Build adjacency for BFS path finding.
  const switchAdjacency = new Map<string, Set<string>>();
  switchLinks.forEach(link => {
    const sourceSwitch = link.sourceSwitch?.trim() ?? '';
    const targetSwitch = link.targetSwitch?.trim() ?? '';
    if (sourceSwitch === '' || targetSwitch === '') return;

    if (!switchAdjacency.has(sourceSwitch)) {
      switchAdjacency.set(sourceSwitch, new Set());
    }
    if (!switchAdjacency.has(targetSwitch)) {
      switchAdjacency.set(targetSwitch, new Set());
    }

    switchAdjacency.get(sourceSwitch)!.add(targetSwitch);
    switchAdjacency.get(targetSwitch)!.add(sourceSwitch);
  });

  // Pre-index published traffic by "ethType|mac" → [publisherSwitch, ...].
  // This avoids an O(publishers × entries) linear scan per subscription.
  const publishedBySig = new Map<string, string[]>();
  publishedTrafficByIed.forEach((entries, publisherName) => {
    const publisherSwitch = iedToSwitch.get(publisherName);
    if (!publisherSwitch) return;
    entries.forEach(entry => {
      if (!entry.mac) return;
      const sig = `${entry.ethType}|${entry.mac}`;
      const list = publishedBySig.get(sig);
      if (list) {
        list.push(publisherSwitch);
      } else {
        publishedBySig.set(sig, [publisherSwitch]);
      }
    });
  });

  // Path cache keyed by "publisherSwitch::subscriberSwitch" to avoid
  // repeated BFS for the same switch pair across many subscriptions.
  const pathCache = new Map<string, string[]>();
  const getCachedPath = (from: string, to: string): string[] => {
    if (from === to) return [from];
    const key = `${from}::${to}`;
    const cached = pathCache.get(key);
    if (cached !== undefined) return cached;
    const path = findSwitchPath(from, to, switchAdjacency);
    pathCache.set(key, path);
    return path;
  };

  const edgeVlanMap = new Map<string, Set<number>>();

  // For each subscribed IED, look up the matching publisher switches directly
  // from the pre-built index instead of scanning all publishers.
  subscribedTrafficByIed.forEach((subscriptionEntries, subscriberName) => {
    const subscriberSwitch = iedToSwitch.get(subscriberName);
    if (!subscriberSwitch) return;

    subscriptionEntries.forEach(subscription => {
      if (subscription.vlan === 0) return;

      const sig = `${subscription.ethType}|${subscription.mac}`;
      const publisherSwitches = publishedBySig.get(sig);
      if (!publisherSwitches) return;

      publisherSwitches.forEach(publisherSwitch => {
        const path = getCachedPath(publisherSwitch, subscriberSwitch);
        if (path.length <= 1) return;

        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < path.length - 1; i++) {
          const edgeKey = getUndirectedEdgeKey(path[i], path[i + 1]);
          if (!edgeVlanMap.has(edgeKey)) {
            edgeVlanMap.set(edgeKey, new Set());
          }
          edgeVlanMap.get(edgeKey)!.add(subscription.vlan);
        }
      });
    });
  });

  return edgeVlanMap;
}

export function getAllShortestPaths(
  start: string,
  end: string,
  adjacency: Map<string, Set<string>>
): string[][] {
  const queue: string[] = [start];
  const distances = new Map<string, number>([[start, 0]]);
  const predecessors = new Map<string, string[]>();

  while (queue.length > 0) {
    const current = queue.shift();
    // eslint-disable-next-line no-continue
    if (!current) continue;

    const currentDistance = distances.get(current) ?? 0;
    const neighbors = Array.from(adjacency.get(current) ?? []).sort((a, b) =>
      a.localeCompare(b)
    );

    neighbors.forEach(neighbor => {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1);
        predecessors.set(neighbor, [current]);
        queue.push(neighbor);
        return;
      }

      if (distances.get(neighbor) === currentDistance + 1) {
        predecessors.set(neighbor, [
          ...(predecessors.get(neighbor) ?? []),
          current
        ]);
      }
    });
  }

  if (!distances.has(end)) return [];

  const shortestPaths: string[][] = [];
  const walk = (node: string, suffix: string[]) => {
    if (node === start) {
      shortestPaths.push([start, ...suffix]);
      return;
    }

    const preds = predecessors.get(node) ?? [];
    preds.forEach(pred => walk(pred, [node, ...suffix]));
  };

  walk(end, []);
  return shortestPaths;
}

export function calculateAndHighlightPaths(args: {
  start: string;
  end: string;
  edges: RoutingEdge[];
  maxPaths?: number;
}): {
  allSimplePaths: string[][];
  shortestPaths: string[][];
  highlightedEdges: string[];
  highlightedShortestEdges: string[];
  highlightedNodes: string[];
  truncated: boolean;
} {
  const { start, end, edges, maxPaths = 10000 } = args;
  const adjacency = new Map<string, Set<string>>();

  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const allSimplePaths: string[][] = [];
  const path: string[] = [start];
  const visited = new Set([start]);
  let truncated = false;

  const dfs = (current: string) => {
    if (allSimplePaths.length >= maxPaths) {
      truncated = true;
      return;
    }

    if (current === end) {
      allSimplePaths.push([...path]);
      return;
    }

    const neighbors = Array.from(adjacency.get(current) ?? []).sort((a, b) =>
      a.localeCompare(b)
    );

    neighbors.forEach(neighbor => {
      if (visited.has(neighbor)) return;
      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor);
      path.pop();
      visited.delete(neighbor);
    });
  };

  dfs(start);

  const shortestPaths = getAllShortestPaths(start, end, adjacency);
  const highlightedEdges = new Set<string>();
  const highlightedShortestEdges = new Set<string>();
  const highlightedNodes = new Set<string>();

  allSimplePaths.forEach(simplePath => {
    simplePath.forEach(node => highlightedNodes.add(node));
    for (let i = 0; i < simplePath.length - 1; i += 1) {
      highlightedEdges.add(
        getUndirectedEdgeKey(simplePath[i], simplePath[i + 1])
      );
    }
  });

  shortestPaths.forEach(shortestPath => {
    for (let i = 0; i < shortestPath.length - 1; i += 1) {
      highlightedShortestEdges.add(
        getUndirectedEdgeKey(shortestPath[i], shortestPath[i + 1])
      );
    }
  });

  return {
    allSimplePaths,
    shortestPaths,
    highlightedEdges: Array.from(highlightedEdges),
    highlightedShortestEdges: Array.from(highlightedShortestEdges),
    highlightedNodes: Array.from(highlightedNodes),
    truncated
  };
}
