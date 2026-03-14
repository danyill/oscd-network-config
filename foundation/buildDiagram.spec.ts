import { expect } from '@open-wc/testing';

import { buildSwitchDiagramModel } from './buildDiagram.js';
import { getUndirectedEdgeKey, type SwitchLink } from './switchRouting.js';

const switchLinks: SwitchLink[] = [
  {
    sourceSwitch: 'Sw1',
    sourcePort: 'P1',
    targetSwitch: 'Sw2',
    targetPort: 'P2'
  }
];

const portData = [
  {
    switchName: 'Sw1',
    portName: 'Port1',
    iedName: 'P1',
    receivingPortName: 'Port 5'
  },
  {
    switchName: 'Sw2',
    portName: 'Port1',
    iedName: 'MU1',
    receivingPortName: 'Port 5'
  }
];

const publishedTrafficByIed = new Map([
  [
    'MU1',
    [
      {
        mac: '01-0C-CD-01-00-01',
        ethType: '0x88B8',
        vlan: 1
      }
    ]
  ]
]);

const subscribedTrafficByIed = new Map([
  [
    'P1',
    [
      {
        mac: '01-0C-CD-01-00-01',
        ethType: '0x88B8',
        vlan: 1
      }
    ]
  ]
]);

// Seven distinct VLANs to test truncation (>6)
const manyVlanPublished = new Map([
  [
    'MU1',
    [1, 2, 3, 4, 5, 6, 7].map(vlan => ({
      mac: `01-0C-CD-01-00-0${vlan}`,
      ethType: '0x88B8',
      vlan
    }))
  ]
]);

const manyVlanSubscribed = new Map([
  [
    'P1',
    [1, 2, 3, 4, 5, 6, 7].map(vlan => ({
      mac: `01-0C-CD-01-00-0${vlan}`,
      ethType: '0x88B8',
      vlan
    }))
  ]
]);

const baseOptions = {
  switchLinks,
  portData,
  includeIedInDiagram: true,
  includeUnsubscribedMessages: false,
  diagramLayout: 'dot',
  edgeRouting: 'spline',
  diagramSpacing: 'normal',
  vlanLabelFormat: 'dec' as const,
  publishedTrafficByIed,
  subscribedTrafficByIed
};

describe('buildSwitchDiagramModel', () => {
  it('adds VLAN labels for subscription paths', () => {
    const result = buildSwitchDiagramModel(baseOptions);

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.edgeLabelByKey.get(edgeKey)).to.equal('1');
    expect(result.dot).to.contain('"Sw1" -> "Sw2"');
  });

  it('renders hex VLAN labels with 0x prefix', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      vlanLabelFormat: 'hex'
    });

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    expect(result.edgeLabelByKey.get(edgeKey)).to.equal('0x001');
  });

  it('truncates VLAN list to 6 with (+N) suffix when more than 6 VLANs', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      publishedTrafficByIed: manyVlanPublished,
      subscribedTrafficByIed: manyVlanSubscribed
    });

    const edgeKey = getUndirectedEdgeKey('Sw1', 'Sw2');
    const label = result.edgeLabelByKey.get(edgeKey) ?? '';
    expect(label).to.contain('(+1)');
    // Should show first 6 VLANs
    expect(label).to.contain('1');
    expect(label).to.contain('6');
    // The 7th VLAN is hidden in the (+1) suffix
    expect(label).to.not.contain(', 7');
  });

  it('uses label attribute for non-ortho edge routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      edgeRouting: 'spline'
    });

    expect(result.dot).to.contain('label=');
    expect(result.dot).to.not.contain('xlabel=');
  });

  it('uses xlabel attribute for ortho edge routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      edgeRouting: 'ortho'
    });

    expect(result.dot).to.contain('xlabel=');
    expect(result.dot).to.not.contain(', label=');
  });

  it('includes forcelabels=true in graph attrs when using ortho routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      edgeRouting: 'ortho'
    });

    expect(result.dot).to.contain('forcelabels=true');
  });

  it('does not include forcelabels when not using ortho routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      edgeRouting: 'spline'
    });

    expect(result.dot).to.not.contain('forcelabels');
  });

  it('includes pack=true and packmode for dot layout', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      diagramLayout: 'dot'
    });

    expect(result.dot).to.contain('pack=true');
    expect(result.dot).to.contain('packmode="graph"');
  });

  it('does not include pack attributes for force layouts', () => {
    for (const layout of ['neato', 'fdp']) {
      const result = buildSwitchDiagramModel({
        ...baseOptions,
        diagramLayout: layout
      });

      expect(result.dot).to.not.contain('pack=true');
      expect(result.dot).to.not.contain('packmode=');
    }
  });

  it('uses minlen=2 for dot layout', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      diagramLayout: 'dot',
      edgeRouting: 'spline'
    });

    expect(result.dot).to.match(/edge \[[^\]]*minlen=2[^\]]*\]/);
  });

  it('uses minlen=8 for force layout with ortho routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      diagramLayout: 'neato',
      edgeRouting: 'ortho'
    });

    expect(result.dot).to.match(/edge \[[^\]]*minlen=8[^\]]*\]/);
  });

  it('uses minlen=4 for force layout with non-ortho routing', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      diagramLayout: 'neato',
      edgeRouting: 'spline'
    });

    expect(result.dot).to.match(/edge \[[^\]]*minlen=4[^\]]*\]/);
  });

  it('includes IED nodes when includeIedInDiagram is true', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      includeIedInDiagram: true
    });

    expect(result.dot).to.contain('"P1"');
    expect(result.dot).to.contain('"MU1"');
    expect(result.dot).to.contain('"Sw1" -> "P1"');
    expect(result.dot).to.contain('"Sw2" -> "MU1"');
  });

  it('excludes IED nodes when includeIedInDiagram is false', () => {
    const result = buildSwitchDiagramModel({
      ...baseOptions,
      includeIedInDiagram: false
    });

    expect(result.dot).to.not.contain('"Sw1" -> "P1"');
    expect(result.dot).to.not.contain('"Sw2" -> "MU1"');
  });

  it('includes unsubscribed published traffic when includeUnsubscribedMessages is true', () => {
    const unsubscribedPublished = new Map([
      ['MU1', [{ mac: '01-0C-CD-01-00-FF', ethType: '0x88B8', vlan: 99 }]]
    ]);

    const result = buildSwitchDiagramModel({
      ...baseOptions,
      includeUnsubscribedMessages: true,
      publishedTrafficByIed: unsubscribedPublished,
      subscribedTrafficByIed: new Map()
    });

    // VLAN 99 is on MU1's IED edge when unsubscribed messages are included
    const edgeKey = getUndirectedEdgeKey('Sw2', 'MU1');
    const label = result.edgeLabelByKey.get(edgeKey) ?? '';
    expect(label).to.contain('99');
  });
});
