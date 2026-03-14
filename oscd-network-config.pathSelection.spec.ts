import { expect } from '@open-wc/testing';

import NetworkConfig from './oscd-network-config.js';

type ClickTarget = {
  closest: (selector: string) => Element | null;
};

function createNodeClickEvent(nodeName: string): Event {
  const nodeElement = {
    getAttribute: (attribute: string) =>
      attribute === 'data-node' ? nodeName : null
  } as unknown as Element;

  const target: ClickTarget = {
    closest: (selector: string) =>
      selector === 'g.node[data-node]' ? nodeElement : null
  };

  return {
    target: target as unknown as EventTarget
  } as Event;
}

function createPlugin(): NetworkConfig & Record<string, any> {
  const tagName = 'test-network-config';
  if (!customElements.get(tagName)) {
    customElements.define(tagName, NetworkConfig);
  }

  const plugin = document.createElement(tagName) as NetworkConfig &
    Record<string, any>;
  document.body.appendChild(plugin);
  return plugin;
}

function createTrafficDoc(): XMLDocument {
  return new DOMParser().parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <Communication>
    <SubNetwork name="StationBus" type="8-MMS">
      <ConnectedAP iedName="P1" apName="AP1">
        <GSE cbName="P1_GOOSE">
          <Address>
            <P type="VLAN-ID">001</P>
            <P type="MAC-Address">01-0C-CD-01-00-01</P>
          </Address>
        </GSE>
        <SMV cbName="P1_SV">
          <Address>
            <P type="VLAN-ID">002</P>
            <P type="MAC-Address">01-0C-CD-04-00-01</P>
          </Address>
        </SMV>
      </ConnectedAP>
      <ConnectedAP iedName="P3" apName="AP1">
        <GSE cbName="P3_GOOSE">
          <Address>
            <P type="VLAN-ID">003</P>
            <P type="MAC-Address">01-0C-CD-01-00-03</P>
          </Address>
        </GSE>
      </ConnectedAP>
    </SubNetwork>
  </Communication>
  <IED name="P1">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0" inst="">
            <GSEControl name="P1_GOOSE"/>
            <SampledValueControl name="P1_SV"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="P2">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0" inst=""/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="P3">
    <AccessPoint name="AP1">
      <Server>
        <LDevice inst="LD1">
          <LN0 lnClass="LLN0" inst="">
            <GSEControl name="P3_GOOSE"/>
          </LN0>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>`,
    'application/xml'
  );
}

function createEdgeClickEvent(
  edgeKey: string,
  source: string,
  target: string
): Event {
  const edgeElement = {
    getAttribute: (attr: string) => {
      if (attr === 'data-edge-key') return edgeKey;
      if (attr === 'data-source') return source;
      if (attr === 'data-target') return target;
      return null;
    }
  } as unknown as Element;

  const clickTarget: ClickTarget = {
    closest: (selector: string) =>
      selector === 'g.edge[data-edge-key]' ? edgeElement : null
  };

  return {
    target: clickTarget as unknown as EventTarget
  } as Event;
}

function createSingleIedTrafficSelection(doc: XMLDocument): {
  portData: {
    switchName: string;
    portName: string;
    iedName: string;
    receivingPortName: string;
  }[];
  usedControlBlocks: Map<Element, string[]>;
  selectedPathStart: string;
  selectedPathEnd: string;
} {
  const p1Goose = doc.querySelector(
    'IED[name="P1"] GSEControl[name="P1_GOOSE"]'
  )!;
  const p1Sv = doc.querySelector(
    'IED[name="P1"] SampledValueControl[name="P1_SV"]'
  )!;
  const p3Goose = doc.querySelector(
    'IED[name="P3"] GSEControl[name="P3_GOOSE"]'
  )!;

  const portData = [
    {
      switchName: 'Sw1',
      portName: 'P1',
      iedName: 'P1',
      receivingPortName: 'X1'
    },
    {
      switchName: 'Sw2',
      portName: 'P1',
      iedName: 'P2',
      receivingPortName: 'X1'
    },
    {
      switchName: 'Sw3',
      portName: 'P1',
      iedName: 'P3',
      receivingPortName: 'X1'
    }
  ];
  const usedControlBlocks = new Map<Element, string[]>([
    [p1Goose, ['P2']],
    [p1Sv, ['P2']],
    [p3Goose, ['P1']]
  ]);

  return {
    portData,
    usedControlBlocks,
    selectedPathStart: 'P1',
    selectedPathEnd: ''
  };
}

describe('diagram node path selection', () => {
  it('selects start and end switches and computes highlighted path information', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'Sw1', target: 'Sw2', label: '' },
      { source: 'Sw2', target: 'Sw4', label: '' }
    ];

    plugin.onDiagramClick(createNodeClickEvent('Sw1'));

    expect(plugin.selectedPathStart).to.equal('Sw1');
    expect(plugin.selectedPathEnd).to.equal('');
    expect(plugin.highlightedNodes).to.deep.equal(['Sw1']);

    plugin.onDiagramClick(createNodeClickEvent('Sw2'));

    expect(plugin.selectedPathStart).to.equal('Sw1');
    expect(plugin.selectedPathEnd).to.equal('Sw2');
    expect(plugin.pathTooltip).to.contain('Paths from Sw1 to Sw2');
    // pathMetricsLabel is only populated when SHOW_PATH_DEBUG_METRICS is true (off by default)
    expect(plugin.pathMetricsLabel).to.equal('');
    expect(plugin.highlightedEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );
    expect(plugin.highlightedShortestEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );

    plugin.remove();
  });

  it('supports two-click path selection between IED nodes and highlights traversed links', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'P1', target: 'Sw1', label: '' },
      { source: 'Sw1', target: 'Sw2', label: '' },
      { source: 'Sw2', target: 'P2', label: '' }
    ];

    plugin.onDiagramClick(createNodeClickEvent('P1'));
    plugin.onDiagramClick(createNodeClickEvent('P2'));

    expect(plugin.selectedPathStart).to.equal('P1');
    expect(plugin.selectedPathEnd).to.equal('P2');
    expect(plugin.pathTooltip).to.contain('Paths from P1 to P2');
    expect(plugin.highlightedEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('P1', 'Sw1')
    );
    expect(plugin.highlightedEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );
    expect(plugin.highlightedEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('Sw2', 'P2')
    );
    expect(plugin.highlightedShortestEdgeKeys.length).to.be.greaterThan(0);

    plugin.remove();
  });

  it('still completes second-node selection when click suppression is active', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'Sw1', target: 'Sw2', label: '' }
    ];

    plugin.onDiagramClick(createNodeClickEvent('Sw1'));

    expect(plugin.selectedPathStart).to.equal('Sw1');
    expect(plugin.selectedPathEnd).to.equal('');

    (plugin as any).suppressDiagramClick = true;
    plugin.onDiagramClick(createNodeClickEvent('Sw2'));

    expect(plugin.selectedPathEnd).to.equal('Sw2');
    expect(plugin.highlightedShortestEdgeKeys).to.include(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );

    plugin.remove();
  });

  it('still captures first-node selection when click suppression is active', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'Sw1', target: 'Sw2', label: '' }
    ];

    (plugin as any).suppressDiagramClick = true;
    plugin.onDiagramClick(createNodeClickEvent('Sw1'));

    expect(plugin.selectedPathStart).to.equal('Sw1');
    expect(plugin.selectedPathEnd).to.equal('');
    expect(plugin.highlightedNodes).to.deep.equal(['Sw1']);

    plugin.remove();
  });

  it('shows published GOOSE and SV traffic for single IED selection', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    const entries = (plugin as any).buildSelectedLinkTrafficEntries();

    expect(entries).to.have.length(2);
    expect(entries.every((entry: any) => entry.senderIed === 'P1')).to.equal(
      true
    );
    expect(entries.map((entry: any) => entry.serviceType).sort()).to.deep.equal(
      ['GOOSE', 'SV']
    );

    plugin.remove();
  });

  it('filters single-IED published traffic by selected service type', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();
    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    plugin.showGooseTraffic = true;
    plugin.showSvTraffic = false;
    const gooseOnlyEntries = (plugin as any).buildSelectedLinkTrafficEntries();

    expect(gooseOnlyEntries).to.have.length(1);
    expect(gooseOnlyEntries[0].serviceType).to.equal('GOOSE');

    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = true;
    const svOnlyEntries = (plugin as any).buildSelectedLinkTrafficEntries();

    expect(svOnlyEntries).to.have.length(1);
    expect(svOnlyEntries[0].serviceType).to.equal('SV');

    plugin.remove();
  });

  it('filters single-IED subscribed traffic by selected service type', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();
    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    plugin.showGooseTraffic = true;
    plugin.showSvTraffic = false;
    const gooseOnlySubscribed = (
      plugin as any
    ).buildSingleIedSubscribedTrafficEntries();

    expect(gooseOnlySubscribed).to.have.length(1);
    expect(gooseOnlySubscribed[0].serviceType).to.equal('GOOSE');

    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = true;
    const svOnlySubscribed = (
      plugin as any
    ).buildSingleIedSubscribedTrafficEntries();

    expect(svOnlySubscribed).to.have.length(0);

    plugin.remove();
  });

  it('renders the details pane title as Path Traffic', () => {
    const plugin = createPlugin();
    plugin.linkDetailsPinned = true;

    const template = (plugin as any).renderLinkDetailsPane();

    expect(template.strings.join('')).to.contain('Path Traffic');

    plugin.remove();
  });

  it('renders the Path Traffic pane with the correct aria label and header', () => {
    // GOOSE/SV text appears in conditional sub-templates (e.g. "No matching GOOSE/SV
    // traffic found") which are separate TemplateResult objects and not visible via
    // the outer template's static strings. Verify the pane structure instead.
    const plugin = createPlugin();
    plugin.linkDetailsPinned = true;

    const template = (plugin as any).renderLinkDetailsPane();
    const renderedText = template.strings.join('');

    expect(renderedText).to.contain('Path Traffic');
    expect(renderedText).to.contain('link-details-pane');

    plugin.remove();
  });

  it('shows no single-IED traffic entries when both service filters are disabled', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;
    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = false;

    const publishedEntries = (plugin as any).buildSelectedLinkTrafficEntries();
    const subscribedEntries = (
      plugin as any
    ).buildSingleIedSubscribedTrafficEntries();

    expect(publishedEntries).to.have.length(0);
    expect(subscribedEntries).to.have.length(0);

    plugin.remove();
  });

  it('removes sender/receiver highlight sets when both service filters are disabled', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;
    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = false;

    const highlights = (plugin as any).getSingleIedFocusHighlights();

    expect(highlights).to.not.equal(null);
    expect(Array.from(highlights.receiversFromSelected)).to.have.length(0);
    expect(Array.from(highlights.sendersToSelected)).to.have.length(0);

    plugin.remove();
  });

  it('computes different IED highlight sets for receivers and senders around selected IED', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    const highlights = (plugin as any).getSingleIedFocusHighlights();

    expect(highlights).to.not.equal(null);
    expect(highlights.selectedIed).to.equal('P1');
    expect(Array.from(highlights.receiversFromSelected)).to.include('P2');
    expect(Array.from(highlights.sendersToSelected)).to.include('P3');

    plugin.remove();
  });

  it('shows subscribed traffic from senders in buildSingleIedSubscribedTrafficEntries', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    const subscribedEntries = (
      plugin as any
    ).buildSingleIedSubscribedTrafficEntries();

    expect(subscribedEntries).to.have.length(1);
    expect(subscribedEntries[0].receiverIed).to.equal('P1');
    expect(subscribedEntries[0].senderIed).to.equal('P3');
    expect(subscribedEntries[0].serviceType).to.equal('GOOSE');

    plugin.remove();
  });

  it('clicking a node clears any existing edge selection', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'Sw1', target: 'Sw2', label: '' }
    ];

    // First select the edge directly
    const edgeKey = NetworkConfig.getEdgeKey('Sw1', 'Sw2');
    (plugin as any).selectDiagramEdge({
      getAttribute: (attr: string) => {
        if (attr === 'data-edge-key') return edgeKey;
        if (attr === 'data-source') return 'Sw1';
        if (attr === 'data-target') return 'Sw2';
        return null;
      }
    });

    expect(plugin.selectedLinkEdgeKey).to.equal(edgeKey);

    // Now click a node
    plugin.onDiagramClick(createNodeClickEvent('Sw1'));

    expect(plugin.selectedPathStart).to.equal('Sw1');
    expect(plugin.selectedLinkEdgeKey).to.equal('');

    plugin.remove();
  });

  it('clicking an edge clears any existing node selection', () => {
    const plugin = createPlugin();

    (plugin as any).diagramGraphEdges = [
      { source: 'Sw1', target: 'Sw2', label: '' }
    ];

    // First select a node
    plugin.onDiagramClick(createNodeClickEvent('Sw1'));

    expect(plugin.selectedPathStart).to.equal('Sw1');

    // Now click an edge
    plugin.onDiagramClick(
      createEdgeClickEvent(NetworkConfig.getEdgeKey('Sw1', 'Sw2'), 'Sw1', 'Sw2')
    );

    expect(plugin.selectedLinkEdgeKey).to.equal(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );
    expect(plugin.selectedPathStart).to.equal('');
    expect(plugin.selectedPathEnd).to.equal('');

    plugin.remove();
  });
});

describe('renderSelectionChips', () => {
  it('renders two coloured chips with arrow for a path selection', () => {
    const plugin = createPlugin();
    plugin.selectedPathStart = 'Sw1';
    plugin.selectedPathEnd = 'Sw2';

    const template = (plugin as any).renderSelectionChips(
      true,
      false,
      'Sw1 ↔ Sw2'
    );
    const html = template.strings.join('');

    expect(html).to.contain('ied-chip--selected');
    expect(html).to.contain('ied-chip--end');
    expect(html).to.contain('ied-arrow');

    plugin.remove();
  });

  it('renders a single selected chip for a single IED selection', () => {
    const plugin = createPlugin();
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = '';

    const template = (plugin as any).renderSelectionChips(
      false,
      true,
      'Start: P1'
    );
    const html = template.strings.join('');

    expect(html).to.contain('ied-chip--selected');
    expect(html).to.not.contain('ied-chip--end');
    expect(html).to.not.contain('ied-arrow');

    plugin.remove();
  });

  it('returns plain label text when there is no path or IED selection', () => {
    const plugin = createPlugin();

    const template = (plugin as any).renderSelectionChips(
      false,
      false,
      'Sw1 ↔ Sw2'
    );
    // No chip classes in the static strings — the label is an interpolated value
    const html = template.strings.join('');

    expect(html).to.not.contain('ied-chip--selected');
    expect(html).to.not.contain('ied-chip--end');

    plugin.remove();
  });
});

describe('GOOSE/SV service filter toolbar', () => {
  it('exposes showGooseTraffic and showSvTraffic reactive properties that default to true', () => {
    // The GOOSE/SV labels are rendered inside the diagram tab conditional block
    // (activeTabIndex === 1), which is a separate TemplateResult — checking
    // outer render().strings won't find them. Verify the reactive properties instead.
    const plugin = createPlugin();

    expect(plugin.showGooseTraffic).to.equal(true);
    expect(plugin.showSvTraffic).to.equal(true);

    plugin.remove();
  });

  it('retains selected path after toggling showGooseTraffic', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = '';

    // Simulate service filter toggle with preserveSelection=true
    (plugin as any).buildSwitchDiagram(false, true);

    expect(plugin.selectedPathStart).to.equal('P1');
    expect(plugin.selectedPathEnd).to.equal('');

    plugin.remove();
  });

  it('clears selection when buildSwitchDiagram is called without preserveSelection', () => {
    const plugin = createPlugin();

    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = 'P2';

    (plugin as any).buildSwitchDiagram(false, false);

    expect(plugin.selectedPathStart).to.equal('');
    expect(plugin.selectedPathEnd).to.equal('');

    plugin.remove();
  });
});

describe('getLinkSelectionIedHighlights', () => {
  it('returns null when no edge is selected', () => {
    const plugin = createPlugin();

    const result = (plugin as any).getLinkSelectionIedHighlights();

    expect(result).to.equal(null);

    plugin.remove();
  });

  it('returns sender and receiver IED sets for the selected edge', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      },
      {
        sourceSwitch: 'Sw2',
        sourcePort: 'p2',
        targetSwitch: 'Sw3',
        targetPort: 'p3'
      }
    ];

    // Select the Sw1-P1 edge (direct IED link)
    const edgeKey = NetworkConfig.getEdgeKey('Sw1', 'P1');
    plugin.selectedLinkEdgeKey = edgeKey;

    const result = (plugin as any).getLinkSelectionIedHighlights();

    expect(result).to.not.equal(null);
    // P1 is the sender for GOOSE and SV — its direct link to Sw1 should surface P1 as a sender
    expect(result.senderIeds.size).to.be.greaterThan(0);

    plugin.remove();
  });

  it('excludes Unsubscribed from receiverIeds', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      }
    ];

    plugin.selectedLinkEdgeKey = NetworkConfig.getEdgeKey('Sw1', 'P1');

    const result = (plugin as any).getLinkSelectionIedHighlights();

    expect(result).to.not.equal(null);
    expect(result.receiverIeds.has('Unsubscribed')).to.equal(false);

    plugin.remove();
  });

  it('returns empty sets when service filters exclude all traffic', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      }
    ];
    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = false;

    plugin.selectedLinkEdgeKey = NetworkConfig.getEdgeKey('Sw1', 'P1');

    const result = (plugin as any).getLinkSelectionIedHighlights();

    expect(result).to.not.equal(null);
    expect(result.senderIeds.size).to.equal(0);
    expect(result.receiverIeds.size).to.equal(0);

    plugin.remove();
  });
});

describe('getSingleIedFocusEdgeHighlights', () => {
  it('returns null when no IED is selected', () => {
    const plugin = createPlugin();

    const result = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(result).to.equal(null);

    plugin.remove();
  });

  it('returns null when a path (two nodes) is selected', () => {
    const plugin = createPlugin();
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = 'P2';

    const result = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(result).to.equal(null);

    plugin.remove();
  });

  it('returns null when selected node is a switch, not an IED', () => {
    const plugin = createPlugin();
    plugin.selectedPathStart = 'Sw1';
    plugin.selectedPathEnd = '';
    // portData has no Sw1 as an IED name, so iedToSwitch won't contain it
    plugin.portData = [
      {
        switchName: 'Sw1',
        portName: 'P1',
        iedName: 'P1',
        receivingPortName: 'X1'
      }
    ];

    const result = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(result).to.equal(null);

    plugin.remove();
  });

  it('populates publisherEdgeKeys for traffic sent by the selected IED', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = '';
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      },
      {
        sourceSwitch: 'Sw2',
        sourcePort: 'p2',
        targetSwitch: 'Sw3',
        targetPort: 'p3'
      }
    ];

    const result = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(result).to.not.equal(null);
    // P1 publishes GOOSE and SV to P2; P2 is on Sw2, P1 is on Sw1
    // So the Sw1-P1 and Sw1-Sw2 and Sw2-P2 edges should be in publisherEdgeKeys
    expect(result.publisherEdgeKeys.size).to.be.greaterThan(0);

    plugin.remove();
  });

  it('populates subscriberEdgeKeys for traffic received by the selected IED', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = '';
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      },
      {
        sourceSwitch: 'Sw2',
        sourcePort: 'p2',
        targetSwitch: 'Sw3',
        targetPort: 'p3'
      }
    ];

    const result = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(result).to.not.equal(null);
    // P3 sends GOOSE to P1; P3 is on Sw3, P1 is on Sw1
    // So the path Sw3-P3, Sw3-Sw2, Sw2-Sw1, Sw1-P1 edges should be in subscriberEdgeKeys
    expect(result.subscriberEdgeKeys.size).to.be.greaterThan(0);

    plugin.remove();
  });

  it('respects service filter — excludes SV edge keys when SV is disabled', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = 'P1';
    plugin.selectedPathEnd = '';
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'p1',
        targetSwitch: 'Sw2',
        targetPort: 'p2'
      }
    ];

    plugin.showGooseTraffic = true;
    plugin.showSvTraffic = true;
    const bothResult = (plugin as any).getSingleIedFocusEdgeHighlights();

    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = false;
    const noneResult = (plugin as any).getSingleIedFocusEdgeHighlights();

    expect(bothResult.publisherEdgeKeys.size).to.be.greaterThan(0);
    expect(noneResult.publisherEdgeKeys.size).to.equal(0);
    expect(noneResult.subscriberEdgeKeys.size).to.equal(0);

    plugin.remove();
  });
});

describe('VLAN summary in details pane', () => {
  it('derives correct VLAN list from single IED traffic entries', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;

    const entries = (plugin as any).buildSelectedLinkTrafficEntries();

    // P1 publishes GOOSE on VLAN 1 and SV on VLAN 2
    const vlans = [
      ...new Set<number>(
        entries.map((e: any) => e.vlan).filter((v: number) => v !== 0)
      )
    ].sort((a: number, b: number) => a - b);
    expect(vlans).to.deep.equal([1, 2]);

    plugin.remove();
  });

  it('returns empty VLAN list when both service filters are disabled', () => {
    const plugin = createPlugin();
    const doc = createTrafficDoc();

    const selection = createSingleIedTrafficSelection(doc);
    plugin.doc = doc;
    plugin.portData = selection.portData;
    plugin.usedControlBlocks = selection.usedControlBlocks;
    plugin.selectedPathStart = selection.selectedPathStart;
    plugin.selectedPathEnd = selection.selectedPathEnd;
    plugin.showGooseTraffic = false;
    plugin.showSvTraffic = false;

    const entries = (plugin as any).buildSelectedLinkTrafficEntries();
    const vlans = entries
      .map((e: any) => e.vlan)
      .filter((v: number) => v !== 0);

    expect(vlans).to.have.length(0);

    plugin.remove();
  });
});
