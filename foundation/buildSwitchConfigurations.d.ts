import { type IedTraffic, type SubscribedTrafficEntry } from './sclTraffic.js';
export type ConfigPortDataEntry = {
    switchName: string;
    portName: string;
    iedName: string;
    receivingPortName: string;
};
export type SwitchLink = {
    sourceSwitch: string;
    sourcePort: string;
    targetSwitch: string;
    targetPort: string;
};
export type BuildSwitchConfigOptions = {
    allSwitchesOption: string;
    configureSingleIedConnectivity: boolean;
    selectedIedName: string;
    includePeerIedPortsForSingleIed: boolean;
    selectedSwitchScope: string;
    onlyConfigureIedPorts: boolean;
    includeUnsubscribedMessages: boolean;
    nativeVlan: string;
};
export declare function buildRuggedcomConfigurationText(args: {
    portData: ConfigPortDataEntry[];
    switchLinks: SwitchLink[];
    iedPorts: Set<string>;
    iedTrafficIndex: Map<string, IedTraffic>;
    publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
    subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
    options: BuildSwitchConfigOptions;
}): string;
export declare function buildCiscoConfigurationText(args: {
    portData: ConfigPortDataEntry[];
    switchLinks: SwitchLink[];
    iedPorts: Set<string>;
    iedTrafficIndex: Map<string, IedTraffic>;
    publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
    subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
    options: BuildSwitchConfigOptions;
}): string;
