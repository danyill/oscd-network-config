import type { SubscribedTrafficEntry } from './sclTraffic.js';
import {
  buildSubscriptionEdgeVlanMap,
  getUndirectedEdgeKey,
  type SwitchLink
} from './switchRouting.js';

export type DiagramEdge = {
  source: string;
  target: string;
  label: string;
};

export type DiagramPortDataEntry = {
  switchName: string;
  portName: string;
  iedName: string;
  receivingPortName: string;
};

export type DiagramThemeColors = {
  graphBackground: string;
  switchNodeFill: string;
  switchNodeStroke: string;
  switchNodeFont: string;
  iedNodeFill: string;
  iedNodeStroke: string;
  iedNodeFont: string;
  edgeStroke: string;
  edgeFont: string;
  fontName: string;
};

export type DiagramBuildOptions = {
  switchLinks: SwitchLink[];
  portData: DiagramPortDataEntry[];
  includeIedInDiagram: boolean;
  includeUnsubscribedMessages: boolean;
  diagramLayout: string;
  edgeRouting: string;
  diagramSpacing: string;
  vlanLabelFormat: 'dec' | 'hex';
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  themeColors?: DiagramThemeColors;
};

export function buildSwitchDiagramModel(options: DiagramBuildOptions): {
  dot: string;
  diagramEdges: DiagramEdge[];
  edgeLabelByKey: Map<string, string>;
} {
  const {
    switchLinks,
    portData,
    includeIedInDiagram,
    includeUnsubscribedMessages,
    diagramLayout,
    edgeRouting,
    diagramSpacing,
    vlanLabelFormat,
    publishedTrafficByIed,
    subscribedTrafficByIed,
    themeColors
  } = options;

  const diagramColors: DiagramThemeColors = {
    graphBackground: themeColors?.graphBackground ?? 'transparent',
    switchNodeFill: themeColors?.switchNodeFill ?? '#fed7aa',
    switchNodeStroke: themeColors?.switchNodeStroke ?? '#ea580c',
    switchNodeFont: themeColors?.switchNodeFont ?? '#1f2937',
    iedNodeFill: themeColors?.iedNodeFill ?? '#335522',
    iedNodeStroke: themeColors?.iedNodeStroke ?? '#1d4ed8',
    iedNodeFont: themeColors?.iedNodeFont ?? '#ffffff',
    edgeStroke: themeColors?.edgeStroke ?? '#1d4ed8',
    edgeFont: themeColors?.edgeFont ?? '#1d4ed8',
    fontName: themeColors?.fontName ?? 'Roboto'
  };

  const escapeDotLabel = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const formatVlan = (vlan: number) =>
    vlanLabelFormat === 'hex'
      ? `0x${vlan.toString(16).toUpperCase().padStart(3, '0')}`
      : `${vlan}`;

  const formatVlanList = (vlans: Iterable<number>) => {
    const orderedVlans = [...new Set(vlans)].sort((a, b) => a - b);
    const formatted = [...new Set(orderedVlans.map(formatVlan))];
    if (formatted.length <= 6) return formatted.join(', ');
    return `${formatted.slice(0, 6).join(', ')} (+${formatted.length - 6})`;
  };

  const subscribedTrafficKeys = new Set<string>();
  subscribedTrafficByIed.forEach(entries => {
    entries.forEach(entry => {
      if (entry.mac === '' || entry.ethType === '') return;
      subscribedTrafficKeys.add(`${entry.ethType}|${entry.mac}`);
    });
  });

  const edgeVlanMap = buildSubscriptionEdgeVlanMap({
    switchLinks,
    portData,
    publishedTrafficByIed,
    subscribedTrafficByIed
  });

  const buildSwitchToSwitchTrafficLabel = (
    sourceSwitch: string,
    targetSwitch: string
  ) => {
    const edgeKey = getUndirectedEdgeKey(sourceSwitch, targetSwitch);
    const vlans = edgeVlanMap.get(edgeKey) ?? new Set<number>();
    return formatVlanList(vlans);
  };

  const buildSwitchToIedTrafficLabel = (
    switchName: string,
    iedName: string
  ) => {
    const iedSubscribedVlans = (subscribedTrafficByIed.get(iedName) ?? [])
      .map(entry => entry.vlan)
      .filter(vlan => vlan !== 0);
    const iedPublishedVlans = (publishedTrafficByIed.get(iedName) ?? [])
      .filter(entry => {
        if (entry.vlan === 0) return false;
        if (includeUnsubscribedMessages) return true;
        return subscribedTrafficKeys.has(`${entry.ethType}|${entry.mac}`);
      })
      .map(entry => entry.vlan);

    return formatVlanList([...iedSubscribedVlans, ...iedPublishedVlans]);
  };

  const buildEdgeAttributes = (
    sourcePort: string,
    targetPort: string,
    trafficLabel: string
  ) => {
    const attrs: string[] = ['dir=none'];
    if (sourcePort !== '') attrs.push(`taillabel="${sourcePort}"`);
    if (targetPort !== '') attrs.push(`headlabel="${targetPort}"`);
    if (sourcePort !== '' || targetPort !== '') {
      attrs.push('labeldistance=2.0');
      attrs.push('labelangle=-40');
    }
    if (trafficLabel !== '') {
      // xlabel places the label outside the routed path, which avoids the
      // vertical drift that occurs with splines=ortho where the label tracks
      // the geometric midpoint of a bent polyline rather than its centre.
      const labelAttr = edgeRouting === 'ortho' ? 'xlabel' : 'label';
      attrs.push(`${labelAttr}="${escapeDotLabel(trafficLabel)}"`);
    }
    return attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
  };

  const diagramEdges: DiagramEdge[] = switchLinks.map(link => ({
    source: link.sourceSwitch,
    target: link.targetSwitch,
    label: buildSwitchToSwitchTrafficLabel(link.sourceSwitch, link.targetSwitch)
  }));

  const nodes = [
    ...new Set(
      switchLinks.flatMap(link => [link.sourceSwitch, link.targetSwitch])
    )
  ];

  const calculateSwitchDimensions = (
    switchName: string
  ): { width: number; height: number } => {
    const iedPorts = portData.filter(
      port => port.switchName?.trim() === switchName
    ).length;
    const stationPorts = switchLinks.filter(
      link =>
        link.sourceSwitch === switchName || link.targetSwitch === switchName
    ).length;
    const totalPorts = Math.max(1, iedPorts + stationPorts);
    const baseSize = 0.8;
    const widthScaleFactor = 0.35;
    const heightScaleFactor = 0.03;
    const maxWidth = 2.5;
    const maxHeight = 2.0;
    const logValue = Math.log2(totalPorts + 1);
    const width = Math.min(baseSize + widthScaleFactor * logValue, maxWidth);
    const height = Math.min(baseSize + heightScaleFactor * logValue, maxHeight);
    return { width, height };
  };

  let nodeDeclarations = nodes
    .sort((a, b) => a.localeCompare(b))
    .map(node => {
      const { width, height } = calculateSwitchDimensions(node);
      return `  "${node}" [shape="rect", style="filled", fillcolor="${
        diagramColors.switchNodeFill
      }", color="${diagramColors.switchNodeStroke}", fontcolor="${
        diagramColors.switchNodeFont
      }", width="${width.toFixed(2)}", height="${height.toFixed(2)}"];`;
    })
    .join('\n');

  const switchEdgeDeclarations = switchLinks
    .map(
      link =>
        `  "${link.sourceSwitch}" -> "${
          link.targetSwitch
        }"${buildEdgeAttributes(
          link.sourcePort,
          link.targetPort,
          buildSwitchToSwitchTrafficLabel(link.sourceSwitch, link.targetSwitch)
        )};`
    )
    .join('\n');

  let iedNodeDeclarations = '';
  let iedEdgeDeclarations = '';

  if (includeIedInDiagram && portData.length > 0) {
    const iedNames = [
      ...new Set(
        portData
          .map(port => port.iedName?.trim() ?? '')
          .filter(iedName => iedName !== '')
      )
    ].sort((a, b) => a.localeCompare(b));

    iedNodeDeclarations = iedNames
      .map(
        iedName =>
          `  "${iedName}" [shape=box, style="filled,rounded", fillcolor="${diagramColors.iedNodeFill}", color="${diagramColors.iedNodeStroke}", fontcolor="${diagramColors.iedNodeFont}"];`
      )
      .join('\n');

    iedEdgeDeclarations = [
      ...new Set(
        portData
          .filter(
            port =>
              (port.switchName?.trim() ?? '') !== '' &&
              (port.iedName?.trim() ?? '') !== ''
          )
          .map(port => {
            const switchName = port.switchName.trim();
            const iedName = port.iedName.trim();
            const switchPort = port.portName?.trim() ?? '';
            const iedPort = port.receivingPortName?.trim() ?? '';
            const trafficLabel = buildSwitchToIedTrafficLabel(
              switchName,
              iedName
            );
            const label = buildEdgeAttributes(
              switchPort,
              iedPort,
              trafficLabel
            );

            diagramEdges.push({
              source: switchName,
              target: iedName,
              label: trafficLabel
            });

            return `  "${switchName}" -> "${iedName}"${label};`;
          })
      )
    ].join('\n');
  }

  const uniqueEdgeMap = new Map<string, DiagramEdge>();
  diagramEdges.forEach(edge => {
    const key = getUndirectedEdgeKey(edge.source, edge.target);
    if (!uniqueEdgeMap.has(key)) uniqueEdgeMap.set(key, edge);
  });
  const uniqueEdges = Array.from(uniqueEdgeMap.values());
  const edgeLabelByKey = new Map(
    uniqueEdges.map(edge => [
      getUndirectedEdgeKey(edge.source, edge.target),
      edge.label
    ])
  );

  if (iedNodeDeclarations !== '') {
    nodeDeclarations = [nodeDeclarations, iedNodeDeclarations]
      .filter(line => line !== '')
      .join('\n');
  }

  const edgeDeclarations = [switchEdgeDeclarations, iedEdgeDeclarations]
    .filter(line => line !== '')
    .join('\n');

  const isOrthogonal = edgeRouting === 'ortho';
  const edgeMinlen = (() => {
    if (diagramLayout === 'dot') return 2;
    return isOrthogonal ? 8 : 4;
  })();
  const spacingScale = (() => {
    if (diagramSpacing === 'compact') {
      return { ranksep: 0.4, nodesep: 0.4, k: 0.6 };
    }
    if (diagramSpacing === 'expanded') {
      return { ranksep: 1.2, nodesep: 1.0, k: 1.6 };
    }
    return { ranksep: 0.6, nodesep: 0.6, k: 1.0 };
  })();
  const useForceLayout = diagramLayout !== 'dot';
  const edgeLen = (() => {
    const baseLen = (() => {
      if (diagramSpacing === 'compact') return 1.2;
      if (diagramSpacing === 'expanded') return 3.2;
      return 2.0;
    })();

    return diagramLayout === 'neato' ? baseLen * 1.6 : baseLen;
  })();
  const graphAttrs = [
    `bgcolor="${diagramColors.graphBackground}"`,
    `fontname="${diagramColors.fontName}"`,
    `ranksep=${spacingScale.ranksep}`,
    `nodesep=${spacingScale.nodesep}`,
    `splines=${edgeRouting}`,
    isOrthogonal ? 'forcelabels=true' : '',
    !useForceLayout ? 'pack=true' : '',
    !useForceLayout ? 'packmode="graph"' : '',
    useForceLayout ? 'overlap=false' : '',
    useForceLayout
      ? `sep="+${spacingScale.nodesep * 1.6},+${spacingScale.ranksep * 1.6}"`
      : '',
    useForceLayout ? `K=${spacingScale.k}` : ''
  ]
    .filter(attr => attr !== '')
    .join(', ');
  const edgeAttrs = [
    'fontsize=9',
    `fontname="${diagramColors.fontName}"`,
    `minlen=${edgeMinlen}`,
    useForceLayout ? `len=${edgeLen}` : '',
    `color="${diagramColors.edgeStroke}"`,
    `fontcolor="${diagramColors.edgeFont}"`
  ]
    .filter(attr => attr !== '')
    .join(', ');

  const dot = [
    'digraph NetworkSwitchInformation {',
    '  rankdir=LR;',
    `  graph [${graphAttrs}];`,
    `  node [fontsize=14, fontname="${diagramColors.fontName}"];`,
    `  edge [${edgeAttrs}];`,
    nodeDeclarations,
    edgeDeclarations,
    '}'
  ]
    .filter(line => line !== '')
    .join('\n');

  return {
    dot,
    diagramEdges: uniqueEdges,
    edgeLabelByKey
  };
}
