import { expect } from '@open-wc/testing';

import {
  getUndirectedEdgeKey,
  getAllShortestPaths,
  calculateAndHighlightPaths,
  buildSubscriptionEdgeVlanMap,
  type SwitchLink,
  type PortDataEntry
} from './switchRouting.js';
import { type SubscribedTrafficEntry } from './sclTraffic.js';

// ---------------------------------------------------------------------------
// getUndirectedEdgeKey
// ---------------------------------------------------------------------------

describe('getUndirectedEdgeKey', () => {
  it('returns the same key regardless of argument order', () => {
    expect(getUndirectedEdgeKey('A', 'B')).to.equal(
      getUndirectedEdgeKey('B', 'A')
    );
  });

  it('sorts alphabetically so the lesser node comes first', () => {
    const key = getUndirectedEdgeKey('Sw2', 'Sw1');
    expect(key).to.equal('Sw1::Sw2');
  });

  it('joins the sorted pair with "::"', () => {
    expect(getUndirectedEdgeKey('alpha', 'beta')).to.equal('alpha::beta');
  });

  it('handles identical node names', () => {
    // Self-loop edge — not a realistic graph case but should not throw
    expect(getUndirectedEdgeKey('X', 'X')).to.equal('X::X');
  });
});

// ---------------------------------------------------------------------------
// getAllShortestPaths
// ---------------------------------------------------------------------------

// Helper: build an adjacency map from a list of undirected edges
const buildAdj = (edges: [string, string][]) => {
  const adj = new Map<string, Set<string>>();
  edges.forEach(([a, b]) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  });
  return adj;
};

describe('getAllShortestPaths', () => {
  it('returns empty array when start and end are not connected', () => {
    const adj = buildAdj([['A', 'B']]);
    expect(getAllShortestPaths('A', 'C', adj)).to.deep.equal([]);
  });

  it('returns a single-edge path for directly connected nodes', () => {
    const adj = buildAdj([['A', 'B']]);
    const paths = getAllShortestPaths('A', 'B', adj);
    expect(paths).to.have.length(1);
    expect(paths[0]).to.deep.equal(['A', 'B']);
  });

  it('returns single path through a linear chain', () => {
    // A - B - C
    const adj = buildAdj([
      ['A', 'B'],
      ['B', 'C']
    ]);
    const paths = getAllShortestPaths('A', 'C', adj);
    expect(paths).to.have.length(1);
    expect(paths[0]).to.deep.equal(['A', 'B', 'C']);
  });

  it('returns both shortest paths through a diamond topology', () => {
    // A -> B -> D
    // A -> C -> D
    const adj = buildAdj([
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D']
    ]);
    const paths = getAllShortestPaths('A', 'D', adj);
    expect(paths).to.have.length(2);
    // Paths are sorted deterministically by node name in the implementation
    const pathStrings = paths.map(p => p.join('-'));
    expect(pathStrings).to.include('A-B-D');
    expect(pathStrings).to.include('A-C-D');
  });

  it('ignores longer paths when shorter paths exist in a diamond+shortcut topology', () => {
    // A - B - C - D, also A - D directly (shortcut)
    const adj = buildAdj([
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['A', 'D']
    ]);
    const paths = getAllShortestPaths('A', 'D', adj);
    expect(paths).to.have.length(1);
    expect(paths[0]).to.deep.equal(['A', 'D']);
  });

  it('returns a path from a node to itself', () => {
    const adj = buildAdj([['A', 'B']]);
    const paths = getAllShortestPaths('A', 'A', adj);
    // The start node is already the end, path length is 1
    expect(paths).to.have.length(1);
    expect(paths[0]).to.deep.equal(['A']);
  });
});

// ---------------------------------------------------------------------------
// calculateAndHighlightPaths
// ---------------------------------------------------------------------------

describe('calculateAndHighlightPaths', () => {
  it('returns empty results when start and end are the same node', () => {
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'A',
      edges: [{ source: 'A', target: 'B' }]
    });
    // A single-node "path" is found; no edges to highlight
    expect(result.allSimplePaths).to.have.length(1);
    expect(result.allSimplePaths[0]).to.deep.equal(['A']);
    expect(result.highlightedEdges).to.have.length(0);
    expect(result.highlightedNodes).to.include('A');
    expect(result.truncated).to.equal(false);
  });

  it('finds a single path across one edge', () => {
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'B',
      edges: [{ source: 'A', target: 'B' }]
    });
    expect(result.allSimplePaths).to.have.length(1);
    expect(result.allSimplePaths[0]).to.deep.equal(['A', 'B']);
    expect(result.highlightedEdges).to.include(getUndirectedEdgeKey('A', 'B'));
    expect(result.highlightedNodes).to.include('A');
    expect(result.highlightedNodes).to.include('B');
    expect(result.truncated).to.equal(false);
  });

  it('finds all simple paths in a diamond topology', () => {
    // A - B - D
    // A - C - D
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'D',
      edges: [
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' }
      ]
    });
    expect(result.allSimplePaths).to.have.length(2);
    expect(result.highlightedNodes).to.include('A');
    expect(result.highlightedNodes).to.include('B');
    expect(result.highlightedNodes).to.include('C');
    expect(result.highlightedNodes).to.include('D');
  });

  it('marks shortest edges separately from all highlighted edges', () => {
    // A - B - C - D (long path)
    // A - D (direct shortcut)
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'D',
      edges: [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' },
        { source: 'A', target: 'D' }
      ]
    });
    // Two simple paths exist
    expect(result.allSimplePaths).to.have.length(2);
    // Only the direct edge A-D is the shortest path edge
    expect(result.highlightedShortestEdges).to.deep.equal([
      getUndirectedEdgeKey('A', 'D')
    ]);
    // All edges from all paths are in highlightedEdges
    expect(result.highlightedEdges).to.include(getUndirectedEdgeKey('A', 'B'));
    expect(result.highlightedEdges).to.include(getUndirectedEdgeKey('A', 'D'));
  });

  it('returns empty results for unconnected start/end', () => {
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'Z',
      edges: [{ source: 'A', target: 'B' }]
    });
    expect(result.allSimplePaths).to.have.length(0);
    expect(result.highlightedEdges).to.have.length(0);
    expect(result.highlightedNodes).to.have.length(0);
    expect(result.truncated).to.equal(false);
  });

  it('truncates when number of paths exceeds maxPaths', () => {
    // Create a graph where many paths exist: A-B-...-E with cross links
    // Simple 4-node complete graph has many paths
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'D',
      edges: [
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' }
      ],
      maxPaths: 1
    });
    expect(result.truncated).to.equal(true);
    expect(result.allSimplePaths.length).to.be.at.most(1);
  });

  it('does not truncate when path count is exactly at maxPaths', () => {
    // Diamond: exactly 2 paths
    const result = calculateAndHighlightPaths({
      start: 'A',
      end: 'D',
      edges: [
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' }
      ],
      maxPaths: 2
    });
    expect(result.allSimplePaths).to.have.length(2);
    expect(result.truncated).to.equal(false);
  });
});

// ---------------------------------------------------------------------------
// buildSubscriptionEdgeVlanMap
// ---------------------------------------------------------------------------

describe('buildSubscriptionEdgeVlanMap', () => {
  it('returns an empty map when there are no switch links', () => {
    const result = buildSubscriptionEdgeVlanMap({
      switchLinks: [],
      portData: [{ switchName: 'Sw1', iedName: 'IED1' }],
      publishedTrafficByIed: new Map([
        ['IED1', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]]
      ]),
      subscribedTrafficByIed: new Map([
        ['IED1', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]]
      ])
    });
    expect(result.size).to.equal(0);
  });

  it('returns an empty map when publisher and subscriber are on the same switch', () => {
    // Both IEDs on Sw1 — no inter-switch edge needed
    const result = buildSubscriptionEdgeVlanMap({
      switchLinks: [
        {
          sourceSwitch: 'Sw1',
          sourcePort: 'P1',
          targetSwitch: 'Sw2',
          targetPort: 'P2'
        }
      ],
      portData: [
        { switchName: 'Sw1', iedName: 'Publisher' },
        { switchName: 'Sw1', iedName: 'Subscriber' }
      ],
      publishedTrafficByIed: new Map([
        [
          'Publisher',
          [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
        ]
      ]),
      subscribedTrafficByIed: new Map([
        [
          'Subscriber',
          [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
        ]
      ])
    });
    expect(result.size).to.equal(0);
  });

  it('tags the inter-switch edge with the VLAN when publisher and subscriber are on different switches', () => {
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Publisher' },
      { switchName: 'Sw2', iedName: 'Subscriber' }
    ];
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Publisher',
        [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
      ]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Subscriber',
        [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
      ]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.has(edgeKey)).to.equal(true);
    expect(result.get(edgeKey)!.has(100)).to.equal(true);
  });

  it('tags multiple VLANs on an edge when multiple subscriptions cross it', () => {
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Pub1' },
      { switchName: 'Sw1', iedName: 'Pub2' },
      { switchName: 'Sw2', iedName: 'Sub1' }
    ];
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Pub1', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]],
      ['Pub2', [{ mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 200 }]]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Sub1',
        [
          { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
          { mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 200 }
        ]
      ]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.get(edgeKey)!.has(100)).to.equal(true);
    expect(result.get(edgeKey)!.has(200)).to.equal(true);
  });

  it('skips subscriptions with VLAN 0 (untagged/unknown)', () => {
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Publisher' },
      { switchName: 'Sw2', iedName: 'Subscriber' }
    ];
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Publisher', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 0 }]]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Subscriber', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 0 }]]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    // Edge key exists but no VLAN 0 should be recorded
    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.has(edgeKey)).to.equal(false);
  });

  it('tags edges along a multi-hop path', () => {
    // Sw1 - Sw2 - Sw3, publisher on Sw1, subscriber on Sw3
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      },
      {
        sourceSwitch: 'Sw2',
        sourcePort: 'P3',
        targetSwitch: 'Sw3',
        targetPort: 'P4'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Publisher' },
      { switchName: 'Sw3', iedName: 'Subscriber' }
    ];
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Publisher', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 50 }]]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Subscriber',
        [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 50 }]
      ]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    expect(result.get(getUndirectedEdgeKey('Sw1', 'Sw2'))!.has(50)).to.equal(
      true
    );
    expect(result.get(getUndirectedEdgeKey('Sw2', 'Sw3'))!.has(50)).to.equal(
      true
    );
  });

  it('ignores IEDs not found in portData when building paths', () => {
    // Publisher has no portData entry — path cannot be found
    const result = buildSubscriptionEdgeVlanMap({
      switchLinks: [
        {
          sourceSwitch: 'Sw1',
          sourcePort: 'P1',
          targetSwitch: 'Sw2',
          targetPort: 'P2'
        }
      ],
      portData: [{ switchName: 'Sw2', iedName: 'Subscriber' }],
      publishedTrafficByIed: new Map([
        [
          'Publisher',
          [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
        ]
      ]),
      subscribedTrafficByIed: new Map([
        [
          'Subscriber',
          [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
        ]
      ])
    });
    expect(result.size).to.equal(0);
  });

  it('resolves multiple subscribers sharing the same publisher MAC+ethType signature', () => {
    // Verifies the pre-indexed publisher signature lookup:
    // Sub1 and Sub2 both subscribe to the same GOOSE multicast from Publisher.
    // Each subscriber is on a different switch, so two different edges should be tagged.
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      },
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P3',
        targetSwitch: 'Sw3',
        targetPort: 'P4'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Publisher' },
      { switchName: 'Sw2', iedName: 'Sub1' },
      { switchName: 'Sw3', iedName: 'Sub2' }
    ];
    const mac = '01-0C-CD-01-00-05';
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Publisher', [{ mac, ethType: '0x88B8', vlan: 300 }]]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Sub1', [{ mac, ethType: '0x88B8', vlan: 300 }]],
      ['Sub2', [{ mac, ethType: '0x88B8', vlan: 300 }]]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    // Both edges should be tagged with VLAN 300
    expect(result.get(getUndirectedEdgeKey('Sw1', 'Sw2'))!.has(300)).to.equal(
      true
    );
    expect(result.get(getUndirectedEdgeKey('Sw1', 'Sw3'))!.has(300)).to.equal(
      true
    );
  });

  it('correctly tags an edge when multiple publishers share the same switch and one subscriber is remote', () => {
    // Verifies the path cache: Pub1 and Pub2 are both on Sw1, Sub1 on Sw2.
    // Two different MAC signatures both cross the Sw1-Sw2 edge; the path from
    // Sw1 to Sw2 should be computed once and reused for the second signature.
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Pub1' },
      { switchName: 'Sw1', iedName: 'Pub2' },
      { switchName: 'Sw2', iedName: 'Sub1' }
    ];
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      ['Pub1', [{ mac: '01-0C-CD-01-00-10', ethType: '0x88B8', vlan: 10 }]],
      ['Pub2', [{ mac: '01-0C-CD-01-00-11', ethType: '0x88B8', vlan: 20 }]]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Sub1',
        [
          { mac: '01-0C-CD-01-00-10', ethType: '0x88B8', vlan: 10 },
          { mac: '01-0C-CD-01-00-11', ethType: '0x88B8', vlan: 20 }
        ]
      ]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.get(edgeKey)!.has(10)).to.equal(true);
    expect(result.get(edgeKey)!.has(20)).to.equal(true);
  });

  it('does not tag an edge when ethType differs even if MAC matches', () => {
    // GOOSE and SV can share a MAC in contrived scenarios; the signature
    // includes ethType so they are treated as distinct traffic flows.
    const switchLinks: SwitchLink[] = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'P1',
        targetSwitch: 'Sw2',
        targetPort: 'P2'
      }
    ];
    const portData: PortDataEntry[] = [
      { switchName: 'Sw1', iedName: 'Publisher' },
      { switchName: 'Sw2', iedName: 'Subscriber' }
    ];
    // Publisher sends GOOSE (0x88B8), subscriber expects SV (0x88BA)
    const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Publisher',
        [{ mac: '01-0C-CD-04-00-01', ethType: '0x88B8', vlan: 100 }]
      ]
    ]);
    const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
      [
        'Subscriber',
        [{ mac: '01-0C-CD-04-00-01', ethType: '0x88BA', vlan: 100 }]
      ]
    ]);

    const result = buildSubscriptionEdgeVlanMap({
      switchLinks,
      portData,
      publishedTrafficByIed,
      subscribedTrafficByIed
    });

    // Mismatched ethType — no matching signature — edge should not be tagged
    expect(result.size).to.equal(0);
  });
});
