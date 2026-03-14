export type MacFilterEntry = {
    mac: string;
    ethType: string;
};
export type SubscribedTrafficEntry = MacFilterEntry & {
    vlan: number;
};
export type IedTraffic = {
    vlans: number[];
    publishEntries: MacFilterEntry[];
    subscribeEntries: MacFilterEntry[];
    manufacturer: string;
    type: string;
};
export declare function toMacFilterEntries(trafficEntries: SubscribedTrafficEntry[]): MacFilterEntry[];
export declare function toVlanList(...trafficGroups: SubscribedTrafficEntry[][]): number[];
export declare function getSubscribedTrafficByIed(usedControlBlocks: Map<Element, string[]> | null): Map<string, SubscribedTrafficEntry[]>;
export declare function getPublishedTrafficByIed(doc: XMLDocument): Map<string, SubscribedTrafficEntry[]>;
export declare function buildIedTrafficIndex(doc: XMLDocument, publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>, subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>): Map<string, IedTraffic>;
export declare function getIedNames(doc: XMLDocument): string[];
