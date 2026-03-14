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
export declare const getUndirectedEdgeKey: (a: string, b: string) => string;
export declare function buildSubscriptionEdgeVlanMap(args: {
    switchLinks: SwitchLink[];
    portData: PortDataEntry[];
    publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
    subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
}): Map<string, Set<number>>;
export declare function getAllShortestPaths(start: string, end: string, adjacency: Map<string, Set<string>>): string[][];
export declare function calculateAndHighlightPaths(args: {
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
};
