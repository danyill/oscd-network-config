import { controlBlockGseOrSmv } from '@openscd/scl-lib';

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

export function toMacFilterEntries(
  trafficEntries: SubscribedTrafficEntry[]
): MacFilterEntry[] {
  return [
    ...new Map(
      trafficEntries
        .filter(entry => entry.mac !== '')
        .map(entry => [
          `${entry.ethType}|${entry.mac}`,
          { mac: entry.mac, ethType: entry.ethType }
        ])
    ).values()
  ];
}

export function toVlanList(
  ...trafficGroups: SubscribedTrafficEntry[][]
): number[] {
  return [
    ...new Set(trafficGroups.flatMap(group => group.map(entry => entry.vlan)))
  ]
    .filter(vlan => vlan !== 0)
    .sort((a, b) => a - b);
}

/** Extract MAC and VLAN from an Address element with a single DOM traversal. */
function readAddressPElements(address: Element): {
  mac: string;
  vlanText: string;
} {
  let mac = '';
  let vlanText = '0';
  address.querySelectorAll('Address > P').forEach(p => {
    const pType = p.getAttribute('type');
    if (pType === 'MAC-Address') mac = p.textContent?.trim() ?? '';
    else if (pType === 'VLAN-ID') vlanText = p.textContent ?? '0';
  });
  return { mac, vlanText };
}

export function getSubscribedTrafficByIed(
  usedControlBlocks: Map<Element, string[]> | null
): Map<string, SubscribedTrafficEntry[]> {
  const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>();
  if (!usedControlBlocks) return subscribedTrafficByIed;

  usedControlBlocks.forEach((subscribingIedNames, controlBlock) => {
    const address = controlBlockGseOrSmv(controlBlock);
    if (!address) return;

    const { mac, vlanText } = readAddressPElements(address);
    const vlan = parseInt(vlanText, 16);
    const ethType = address.tagName === 'SMV' ? '0x88BA' : '0x88B8';

    subscribingIedNames.forEach(iedName => {
      const existingEntries = subscribedTrafficByIed.get(iedName) ?? [];
      existingEntries.push({ mac, ethType, vlan });
      subscribedTrafficByIed.set(iedName, existingEntries);
    });
  });

  return subscribedTrafficByIed;
}

export function getPublishedTrafficByIed(
  doc: XMLDocument
): Map<string, SubscribedTrafficEntry[]> {
  const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>();

  doc
    .querySelectorAll(':root > Communication > SubNetwork > ConnectedAP')
    .forEach(connectedAp => {
      const iedName = connectedAp.getAttribute('iedName')?.trim() ?? '';
      if (iedName === '') return;

      connectedAp
        .querySelectorAll(':scope > GSE, :scope > SMV')
        .forEach(address => {
          const { mac, vlanText } = readAddressPElements(address);
          const vlan = parseInt(vlanText, 16);
          const ethType = address.tagName === 'SMV' ? '0x88BA' : '0x88B8';

          const existingEntries = publishedTrafficByIed.get(iedName) ?? [];
          existingEntries.push({ mac, ethType, vlan });
          publishedTrafficByIed.set(iedName, existingEntries);
        });
    });

  return publishedTrafficByIed;
}

export function buildIedTrafficIndex(
  doc: XMLDocument,
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>,
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>
): Map<string, IedTraffic> {
  const iedTrafficIndex = new Map<string, IedTraffic>();

  // Build a single lookup from IED name → element to avoid repeated DOM
  // queries inside the loop (was O(n²) before).
  const iedElementByName = new Map<string, Element>();
  doc.querySelectorAll(':root > IED').forEach(ied => {
    const name = ied.getAttribute('name')?.trim();
    if (name) iedElementByName.set(name, ied);
  });

  const iedNames = new Set([
    ...publishedTrafficByIed.keys(),
    ...subscribedTrafficByIed.keys(),
    ...iedElementByName.keys()
  ]);

  iedNames.forEach(iedName => {
    const publishedTraffic = publishedTrafficByIed.get(iedName) ?? [];
    const subscribedTraffic = subscribedTrafficByIed.get(iedName) ?? [];

    const vlans = toVlanList(publishedTraffic, subscribedTraffic);
    const publishEntries = toMacFilterEntries(publishedTraffic);
    const subscribeEntries = toMacFilterEntries(subscribedTraffic);

    const iedElement = iedElementByName.get(iedName);
    const manufacturer = iedElement?.getAttribute('manufacturer') ?? 'Unknown';
    const type = iedElement?.getAttribute('type') ?? 'Unknown';

    iedTrafficIndex.set(iedName, {
      vlans,
      publishEntries,
      subscribeEntries,
      manufacturer,
      type
    });
  });

  return iedTrafficIndex;
}

export function getIedNames(doc: XMLDocument): string[] {
  return Array.from(doc.querySelectorAll(':root > IED'))
    .map(ied => ied.getAttribute('name') ?? '')
    .filter(name => name !== '');
}
