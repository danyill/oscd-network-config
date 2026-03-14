import { expect } from '@open-wc/testing';

import {
  toMacFilterEntries,
  toVlanList,
  getPublishedTrafficByIed,
  getSubscribedTrafficByIed,
  buildIedTrafficIndex,
  getIedNames,
  type SubscribedTrafficEntry
} from './sclTraffic.js';
import { getUsedCBs } from './getUsedCBs.js';

// ---------------------------------------------------------------------------
// Minimal SCL document used across multiple test groups
// ---------------------------------------------------------------------------
// Two publishers (Publisher1: GSE + SMV, Publisher2: GSE only).
// One ConnectedAP with an empty iedName that should be ignored.
// Two IEDs with manufacturer/type attributes, one without.
// Subscriber IEDs referencing control blocks via ExtRef so getUsedCBs can
// build the Map that getSubscribedTrafficByIed consumes.
const sclXml = `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
  <Communication>
    <SubNetwork name="SN1" type="8-MMS">
      <ConnectedAP iedName="Publisher1" apName="AP1">
        <GSE ldInst="LD1" cbName="GOOSE1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
            <P type="VLAN-ID">064</P>
            <P type="VLAN-PRIORITY">4</P>
          </Address>
        </GSE>
        <SMV ldInst="LD1" cbName="SMV1">
          <Address>
            <P type="MAC-Address">01-0C-CD-04-00-01</P>
            <P type="VLAN-ID">0C8</P>
            <P type="VLAN-PRIORITY">4</P>
          </Address>
        </SMV>
      </ConnectedAP>
      <ConnectedAP iedName="Publisher2" apName="AP1">
        <GSE ldInst="LD2" cbName="GOOSE2">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-02</P>
            <P type="VLAN-ID">0C8</P>
            <P type="VLAN-PRIORITY">4</P>
          </Address>
        </GSE>
      </ConnectedAP>
      <ConnectedAP iedName="" apName="AP1">
        <GSE ldInst="LD1" cbName="GOOSE_IGNORED">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-FF</P>
            <P type="VLAN-ID">FFF</P>
          </Address>
        </GSE>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
  <IED name="Publisher1" manufacturer="ACME" type="Relay1">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0" inst="" lnType="T1">
            <DataSet name="DS1"/>
            <GSEControl name="GOOSE1" datSet="DS1" appID="GOOSE1"/>
            <SampledValueControl name="SMV1" datSet="DS1"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="Publisher2" type="Relay2">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD2">
          <LN0 lnClass="LLN0" inst="" lnType="T2">
            <DataSet name="DS1"/>
            <GSEControl name="GOOSE2" datSet="DS1" appID="GOOSE2"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="Subscriber1" manufacturer="Siemens" type="IED3">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD3">
          <LN0 lnClass="LLN0" inst="" lnType="T3">
            <Inputs>
              <ExtRef iedName="Publisher1" srcLDInst="LD1" srcCBName="GOOSE1" srcLNClass="LLN0"/>
              <ExtRef iedName="Publisher1" srcLDInst="LD1" srcCBName="SMV1"   srcLNClass="LLN0"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="Subscriber2" manufacturer="ABB" type="IED4">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD4">
          <LN0 lnClass="LLN0" inst="" lnType="T4">
            <Inputs>
              <ExtRef iedName="Publisher1" srcLDInst="LD1" srcCBName="GOOSE1" srcLNClass="LLN0"/>
              <ExtRef iedName="Publisher2" srcLDInst="LD2" srcCBName="GOOSE2" srcLNClass="LLN0"/>
            </Inputs>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>`;

const testDoc = new DOMParser().parseFromString(sclXml, 'application/xml');

// Minimal doc with no IEDs / Communication section
const emptyDoc = new DOMParser().parseFromString(
  `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
  <Header id="empty"/>
</SCL>`,
  'application/xml'
);

// ---------------------------------------------------------------------------
// toMacFilterEntries
// ---------------------------------------------------------------------------

describe('toMacFilterEntries', () => {
  it('returns an empty array for an empty input', () => {
    expect(toMacFilterEntries([])).to.deep.equal([]);
  });

  it('filters out entries with an empty MAC address', () => {
    const entries: SubscribedTrafficEntry[] = [
      { mac: '', ethType: '0x88B8', vlan: 100 }
    ];
    expect(toMacFilterEntries(entries)).to.have.length(0);
  });

  it('deduplicates entries that share the same MAC + ethType key', () => {
    const entries: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 200 }
    ];
    const result = toMacFilterEntries(entries);
    expect(result).to.have.length(1);
    expect(result[0].mac).to.equal('01-0C-CD-01-00-01');
    expect(result[0].ethType).to.equal('0x88B8');
  });

  it('keeps entries with the same MAC but different ethType as distinct', () => {
    const entries: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
      { mac: '01-0C-CD-01-00-01', ethType: '0x88BA', vlan: 100 }
    ];
    expect(toMacFilterEntries(entries)).to.have.length(2);
  });

  it('keeps entries with different MACs as distinct', () => {
    const entries: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
      { mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 100 }
    ];
    expect(toMacFilterEntries(entries)).to.have.length(2);
  });
});

// ---------------------------------------------------------------------------
// toVlanList
// ---------------------------------------------------------------------------

describe('toVlanList', () => {
  it('returns an empty array for no groups', () => {
    expect(toVlanList()).to.deep.equal([]);
  });

  it('returns an empty array when all VLANs are 0', () => {
    const group: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 0 }
    ];
    expect(toVlanList(group)).to.deep.equal([]);
  });

  it('filters out 0 VLANs while keeping valid ones', () => {
    const group: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 0 },
      { mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 100 }
    ];
    expect(toVlanList(group)).to.deep.equal([100]);
  });

  it('deduplicates VLANs across multiple groups', () => {
    const g1: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }
    ];
    const g2: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 100 }
    ];
    expect(toVlanList(g1, g2)).to.deep.equal([100]);
  });

  it('sorts VLANs ascending', () => {
    const group: SubscribedTrafficEntry[] = [
      { mac: '01-0C-CD-01-00-03', ethType: '0x88B8', vlan: 300 },
      { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
      { mac: '01-0C-CD-01-00-02', ethType: '0x88B8', vlan: 200 }
    ];
    expect(toVlanList(group)).to.deep.equal([100, 200, 300]);
  });

  it('combines multiple groups correctly', () => {
    const g1: SubscribedTrafficEntry[] = [
      { mac: 'A', ethType: '0x88B8', vlan: 10 }
    ];
    const g2: SubscribedTrafficEntry[] = [
      { mac: 'B', ethType: '0x88B8', vlan: 20 }
    ];
    expect(toVlanList(g1, g2)).to.deep.equal([10, 20]);
  });
});

// ---------------------------------------------------------------------------
// getIedNames
// ---------------------------------------------------------------------------

describe('getIedNames', () => {
  it('returns all IED names from the SCL document', () => {
    const names = getIedNames(testDoc);
    expect(names).to.include('Publisher1');
    expect(names).to.include('Publisher2');
    expect(names).to.include('Subscriber1');
    expect(names).to.include('Subscriber2');
  });

  it('returns an empty array for a doc with no IED elements', () => {
    expect(getIedNames(emptyDoc)).to.deep.equal([]);
  });

  it('does not include IED elements with an empty name attribute', () => {
    const doc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <IED name=""/>
  <IED name="ValidIED"/>
</SCL>`,
      'application/xml'
    );
    const names = getIedNames(doc);
    expect(names).to.deep.equal(['ValidIED']);
  });
});

// ---------------------------------------------------------------------------
// getPublishedTrafficByIed
// ---------------------------------------------------------------------------

describe('getPublishedTrafficByIed', () => {
  it('returns an empty map for a doc with no Communication section', () => {
    const result = getPublishedTrafficByIed(emptyDoc);
    expect(result.size).to.equal(0);
  });

  it('extracts GOOSE entries with ethType 0x88B8', () => {
    const result = getPublishedTrafficByIed(testDoc);
    const pub1 = result.get('Publisher1')!;
    const gooseEntry = pub1.find(e => e.ethType === '0x88B8');
    expect(gooseEntry).to.not.equal(undefined);
    expect(gooseEntry!.mac).to.equal('01-0C-CD-01-00-01');
  });

  it('extracts SMV entries with ethType 0x88BA', () => {
    const result = getPublishedTrafficByIed(testDoc);
    const pub1 = result.get('Publisher1')!;
    const smvEntry = pub1.find(e => e.ethType === '0x88BA');
    expect(smvEntry).to.not.equal(undefined);
    expect(smvEntry!.mac).to.equal('01-0C-CD-04-00-01');
  });

  it('parses VLAN-ID from hex string (0x064 = 100)', () => {
    const result = getPublishedTrafficByIed(testDoc);
    const pub1 = result.get('Publisher1')!;
    const gooseEntry = pub1.find(e => e.ethType === '0x88B8')!;
    // '064' hex = 100 decimal
    expect(gooseEntry.vlan).to.equal(100);
  });

  it('creates separate entries for each ConnectedAP', () => {
    const result = getPublishedTrafficByIed(testDoc);
    expect(result.has('Publisher1')).to.equal(true);
    expect(result.has('Publisher2')).to.equal(true);
  });

  it('ignores ConnectedAP entries with an empty iedName', () => {
    const result = getPublishedTrafficByIed(testDoc);
    // The empty iedName ConnectedAP must not appear as a key
    expect(result.has('')).to.equal(false);
    // Specifically, the GOOSE_IGNORED entry should not be present
    const allMacs = Array.from(result.values())
      .flat()
      .map(e => e.mac);
    expect(allMacs).to.not.include('01-0C-CD-01-00-FF');
  });

  it('defaults VLAN to 0 when VLAN-ID P element is absent', () => {
    const doc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <Communication>
    <SubNetwork name="SN1">
      <ConnectedAP iedName="IED1" apName="AP1">
        <GSE ldInst="LD1" cbName="CB1">
          <Address>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
          </Address>
        </GSE>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
</SCL>`,
      'application/xml'
    );
    const result = getPublishedTrafficByIed(doc);
    expect(result.get('IED1')![0].vlan).to.equal(0);
  });
});

// ---------------------------------------------------------------------------
// getSubscribedTrafficByIed
// ---------------------------------------------------------------------------

describe('getSubscribedTrafficByIed', () => {
  it('returns an empty map when usedControlBlocks is null', () => {
    const result = getSubscribedTrafficByIed(null);
    expect(result.size).to.equal(0);
  });

  it('returns an empty map when usedControlBlocks is an empty Map', () => {
    const result = getSubscribedTrafficByIed(new Map());
    expect(result.size).to.equal(0);
  });

  it('maps subscribing IED names to traffic entries via real control blocks', () => {
    // Use getUsedCBs to build the Map from the test document so that
    // controlBlockGseOrSmv can navigate to the Communication section correctly.
    const usedCBs = getUsedCBs(testDoc);
    // The test document has ExtRef elements so usedCBs should be non-null
    expect(usedCBs).to.not.equal(null);

    const result = getSubscribedTrafficByIed(usedCBs!);

    // Subscriber1 subscribes to GOOSE1 and SMV1
    expect(result.has('Subscriber1')).to.equal(true);
    const sub1Entries = result.get('Subscriber1')!;
    expect(sub1Entries.length).to.be.at.least(1);

    // Subscriber2 subscribes to GOOSE1 and GOOSE2
    expect(result.has('Subscriber2')).to.equal(true);
    const sub2Entries = result.get('Subscriber2')!;
    expect(sub2Entries.length).to.be.at.least(1);
  });

  it('assigns ethType 0x88B8 for GOOSE entries', () => {
    const usedCBs = getUsedCBs(testDoc)!;
    const result = getSubscribedTrafficByIed(usedCBs);

    const sub2 = result.get('Subscriber2') ?? [];
    const gooseEntry = sub2.find(e => e.ethType === '0x88B8');
    expect(gooseEntry).to.not.equal(undefined);
  });

  it('assigns ethType 0x88BA for SMV entries', () => {
    const usedCBs = getUsedCBs(testDoc)!;
    const result = getSubscribedTrafficByIed(usedCBs);

    const sub1 = result.get('Subscriber1') ?? [];
    const smvEntry = sub1.find(e => e.ethType === '0x88BA');
    expect(smvEntry).to.not.equal(undefined);
    expect(smvEntry!.mac).to.equal('01-0C-CD-04-00-01');
  });
});

// ---------------------------------------------------------------------------
// buildIedTrafficIndex
// ---------------------------------------------------------------------------

describe('buildIedTrafficIndex', () => {
  const publishedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
    ['Publisher1', [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]]
  ]);
  const subscribedTrafficByIed = new Map<string, SubscribedTrafficEntry[]>([
    [
      'Subscriber1',
      [{ mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 }]
    ]
  ]);

  it('includes all IEDs from the document even if they have no traffic', () => {
    const result = buildIedTrafficIndex(
      testDoc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );
    // Publisher2 and Subscriber2 are in the doc but not in traffic maps
    expect(result.has('Publisher2')).to.equal(true);
    expect(result.has('Subscriber2')).to.equal(true);
  });

  it('sets manufacturer from the IED element attribute', () => {
    const result = buildIedTrafficIndex(
      testDoc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );
    expect(result.get('Publisher1')!.manufacturer).to.equal('ACME');
    expect(result.get('Subscriber1')!.manufacturer).to.equal('Siemens');
  });

  it('defaults manufacturer to "Unknown" when attribute is absent', () => {
    const result = buildIedTrafficIndex(
      testDoc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );
    // Publisher2 has no manufacturer attribute in the test doc
    expect(result.get('Publisher2')!.manufacturer).to.equal('Unknown');
  });

  it('sets type from the IED element attribute', () => {
    const result = buildIedTrafficIndex(
      testDoc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );
    expect(result.get('Publisher1')!.type).to.equal('Relay1');
  });

  it('defaults type to "Unknown" when attribute is absent', () => {
    const result = buildIedTrafficIndex(
      emptyDoc,
      new Map([['NoAttrIED', []]]),
      new Map()
    );
    expect(result.get('NoAttrIED')!.type).to.equal('Unknown');
  });

  it('computes vlans as the sorted, deduplicated union of published and subscribed VLANs', () => {
    const pub = new Map<string, SubscribedTrafficEntry[]>([
      ['IED1', [{ mac: 'A', ethType: '0x88B8', vlan: 200 }]]
    ]);
    const sub = new Map<string, SubscribedTrafficEntry[]>([
      [
        'IED1',
        [
          { mac: 'B', ethType: '0x88B8', vlan: 100 },
          { mac: 'A', ethType: '0x88B8', vlan: 200 }
        ]
      ]
    ]);
    const result = buildIedTrafficIndex(emptyDoc, pub, sub);
    expect(result.get('IED1')!.vlans).to.deep.equal([100, 200]);
  });

  it('deduplicates publishEntries to unique MAC+ethType pairs', () => {
    const pub = new Map<string, SubscribedTrafficEntry[]>([
      [
        'IED1',
        [
          { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 100 },
          { mac: '01-0C-CD-01-00-01', ethType: '0x88B8', vlan: 200 }
        ]
      ]
    ]);
    const result = buildIedTrafficIndex(emptyDoc, pub, new Map());
    expect(result.get('IED1')!.publishEntries).to.have.length(1);
  });

  it('returns an empty index for an empty doc with empty traffic maps', () => {
    const result = buildIedTrafficIndex(emptyDoc, new Map(), new Map());
    expect(result.size).to.equal(0);
  });
});
