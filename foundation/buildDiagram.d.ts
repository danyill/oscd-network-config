import type { SubscribedTrafficEntry } from './sclTraffic.js';
import { type SwitchLink } from './switchRouting.js';
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
export declare function buildSwitchDiagramModel(options: DiagramBuildOptions): {
    dot: string;
    diagramEdges: DiagramEdge[];
    edgeLabelByKey: Map<string, string>;
};
