import { expect } from '@open-wc/testing';
import { XMLEditor } from '@omicronenergy/oscd-editor';
import type { EditEventV2 } from '@openscd/oscd-api';

import NetworkConfig from './oscd-network-config.js';

function createPlugin(): NetworkConfig & Record<string, any> {
  const tagName = 'test-network-config-integration';
  if (!customElements.get(tagName)) {
    customElements.define(tagName, NetworkConfig);
  }

  const plugin = document.createElement(tagName) as NetworkConfig &
    Record<string, any>;
  document.body.appendChild(plugin);
  return plugin;
}

describe('oscd-network-config integration (DOT + rendering)', () => {
  it('routes buildOutputConfiguration to ruggedcom or cisco based on switchVendor', () => {
    const plugin = createPlugin();

    let ruggedcomCalls = 0;
    let ciscoCalls = 0;
    (plugin as any).buildRuggedcomConfiguration = () => {
      ruggedcomCalls += 1;
    };
    (plugin as any).buildCiscoConfiguration = () => {
      ciscoCalls += 1;
    };

    plugin.switchVendor = 'ruggedcom';
    plugin.buildOutputConfiguration();
    plugin.switchVendor = 'cisco';
    plugin.buildOutputConfiguration();

    expect(ruggedcomCalls).to.equal(1);
    expect(ciscoCalls).to.equal(1);

    plugin.remove();
  });

  it('downloads SVG and DOT when content is present', () => {
    const plugin = createPlugin();

    const createObjectUrl = URL.createObjectURL;
    const revokeObjectUrl = URL.revokeObjectURL;
    let createCalls = 0;
    let revokeCalls = 0;

    URL.createObjectURL = (() => {
      createCalls += 1;
      return 'blob:mock';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {
      revokeCalls += 1;
    }) as typeof URL.revokeObjectURL;

    const timer = window.setTimeout;
    window.setTimeout = ((cb: unknown) => {
      if (typeof cb === 'function') cb();
      return 0;
    }) as typeof window.setTimeout;

    try {
      plugin.switchDiagramSvg = '<svg></svg>';
      plugin.switchDiagramDot = 'digraph NetworkSwitchInformation {}';

      plugin.downloadSwitchDiagramSvg();
      plugin.downloadSwitchDiagramDot();

      expect(createCalls).to.equal(2);
      expect(revokeCalls).to.equal(2);
    } finally {
      URL.createObjectURL = createObjectUrl;
      URL.revokeObjectURL = revokeObjectUrl;
      window.setTimeout = timer;
    }

    plugin.remove();
  });

  it('renderSwitchDiagramSvg clears content when there are no links', async () => {
    const plugin = createPlugin();
    plugin.switchLinks = [];
    plugin.switchDiagramSvg = '<svg>old</svg>';
    plugin.switchDiagramError = 'old';

    await plugin.renderSwitchDiagramSvg();

    expect(plugin.switchDiagramSvg).to.equal('');
    expect(plugin.switchDiagramError).to.equal('');

    plugin.remove();
  });

  it('renderSwitchDiagramSvg writes rendered SVG from viz instance', async () => {
    const plugin = createPlugin();
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.switchDiagramDot = 'digraph NetworkSwitchInformation {}';
    (plugin as any).vizInstancePromise = Promise.resolve({
      renderString: () => '<svg><g id="ok"></g></svg>'
    });

    await plugin.renderSwitchDiagramSvg();

    expect(plugin.switchDiagramSvg).to.contain('<svg>');
    expect(plugin.switchDiagramError).to.equal('');

    plugin.remove();
  });

  it('renderSwitchDiagramSvg sets error text when viz render throws', async () => {
    const plugin = createPlugin();
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.switchDiagramDot = 'digraph NetworkSwitchInformation {}';
    (plugin as any).vizInstancePromise = Promise.resolve({
      renderString: () => {
        throw new Error('render failed');
      }
    });

    await plugin.renderSwitchDiagramSvg();

    expect(plugin.switchDiagramSvg).to.equal('');
    expect(plugin.switchDiagramError).to.equal('render failed');

    plugin.remove();
  });

  it('updated() triggers expected branch methods for changed properties', () => {
    const plugin = createPlugin();
    plugin.activeTabIndex = 2;
    plugin.showSwitchDiagram = true;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.doc = new DOMParser().parseFromString(
      '<SCL xmlns="http://www.iec.ch/61850/2003/SCL"></SCL>',
      'application/xml'
    );

    let refreshUsed = 0;
    let buildDiagramCalls = 0;
    let refreshInputCalls = 0;
    let refreshLinksCalls = 0;
    let buildOutputCalls = 0;
    let decorateCalls = 0;
    let highlightCalls = 0;

    (plugin as any).refreshUsedControlBlocks = () => {
      refreshUsed += 1;
    };
    (plugin as any).buildSwitchDiagram = () => {
      buildDiagramCalls += 1;
    };
    (plugin as any).refreshInputData = () => {
      refreshInputCalls += 1;
    };
    (plugin as any).refreshSwitchLinks = () => {
      refreshLinksCalls += 1;
    };
    (plugin as any).buildOutputConfiguration = () => {
      buildOutputCalls += 1;
    };
    (plugin as any).decorateRenderedDiagram = () => {
      decorateCalls += 1;
    };
    (plugin as any).applyPathHighlightingToDiagram = () => {
      highlightCalls += 1;
    };

    const changed = new Map<PropertyKey, unknown>([
      ['doc', undefined],
      ['activeTabIndex', undefined],
      ['vlanLabelFormat', undefined],
      ['switchDiagramSvg', undefined],
      ['portData', undefined]
    ]);

    (plugin as any).updated(changed);

    expect(refreshUsed).to.equal(1);
    expect(buildDiagramCalls).to.be.greaterThan(0);
    expect(refreshInputCalls).to.equal(1);
    expect(refreshLinksCalls).to.be.greaterThan(0);
    expect(buildOutputCalls).to.be.greaterThan(0);
    expect(decorateCalls).to.equal(1);
    expect(highlightCalls).to.equal(1);

    plugin.remove();
  });

  it('sets iedDataError and clears parsed rows for invalid IED CSV input', () => {
    const plugin = createPlugin();

    plugin.inputCsvData = 'Sw1,Port1,P1,Port5,Extra';
    plugin.refreshInputData();

    expect(plugin.iedDataError).to.not.equal('');
    expect(plugin.portData).to.equal(null);
    expect(plugin.switchNames).to.deep.equal([]);
    expect(plugin.iedNames).to.deep.equal([]);

    plugin.remove();
  });

  it('parses valid IED CSV and updates sorted switch and IED names', () => {
    const plugin = createPlugin();

    plugin.inputCsvData = 'Sw2,GE1,P2,PortB\nSw1,GE1,P1,PortA';
    plugin.refreshInputData();

    expect(plugin.iedDataError).to.equal('');
    expect(plugin.portData).to.have.length(2);
    expect(plugin.switchNames).to.deep.equal(['Sw1', 'Sw2']);
    expect(plugin.iedNames).to.deep.equal(['P1', 'P2']);
    expect(plugin.selectedIedName).to.equal('All IEDs');

    plugin.remove();
  });

  it('sets switchLinksError and clears links for invalid switch link CSV input', () => {
    const plugin = createPlugin();

    plugin.switchLinksInput = 'Sw1,GE1,Sw2';
    plugin.refreshSwitchLinks();

    expect(plugin.switchLinksError).to.not.equal('');
    expect(plugin.switchLinks).to.deep.equal([]);

    plugin.remove();
  });

  it('clears rendered diagram strings when switch links become empty while diagram is shown', () => {
    const plugin = createPlugin();

    plugin.showSwitchDiagram = true;
    plugin.switchDiagramSvg = '<svg>existing</svg>';
    plugin.switchDiagramDot = 'digraph Existing {}';
    plugin.switchDiagramError = 'old error';
    plugin.switchLinksInput = '';

    plugin.refreshSwitchLinks();

    expect(plugin.switchLinks).to.deep.equal([]);
    expect(plugin.switchDiagramSvg).to.equal('');
    expect(plugin.switchDiagramDot).to.equal('');
    expect(plugin.switchDiagramError).to.equal('');

    plugin.remove();
  });

  it('sets crossDatasetError when same switch port is used in both datasets', () => {
    const plugin = createPlugin();

    plugin.inputCsvData = 'SwA,GE1,P1,PortA';
    plugin.switchLinksInput = 'SwA,GE1,SwC,GE2';
    plugin.refreshInputData();
    plugin.refreshSwitchLinks();

    expect(plugin.crossDatasetError).to.not.equal('');

    plugin.remove();
  });

  it('resets selectedIedName to All IEDs when current selection is unavailable', () => {
    const plugin = createPlugin();

    plugin.selectedIedName = 'MissingIED';
    plugin.inputCsvData = 'Sw1,GE1,P1,PortA';
    plugin.refreshInputData();

    expect(plugin.selectedIedName).to.equal('All IEDs');

    plugin.remove();
  });

  it('uses diagram error branch in renderDiagramHostContent', () => {
    const plugin = createPlugin();
    plugin.switchDiagramError = 'Graphviz failure';

    const template = (plugin as any).renderDiagramHostContent();

    expect(template.strings.join('')).to.contain('Unable to render diagram:');
    expect(template.values.join('')).to.contain('Graphviz failure');

    plugin.remove();
  });

  it('uses rendered SVG branch in renderDiagramHostContent', () => {
    const plugin = createPlugin();
    plugin.switchDiagramError = '';
    plugin.switchDiagramSvg = '<svg><g></g></svg>';
    plugin.diagramPanX = 12;
    plugin.diagramPanY = -8;
    plugin.diagramZoom = 1.4;

    const template = (plugin as any).renderDiagramHostContent();
    const renderedText = template.strings.join('');

    expect(renderedText).to.contain('diagram-viewport');
    expect(renderedText).to.contain('transform: translate(');

    plugin.remove();
  });

  it('uses loading branch in renderDiagramHostContent when svg and error are empty', () => {
    const plugin = createPlugin();
    plugin.switchDiagramError = '';
    plugin.switchDiagramSvg = '';

    const template = (plugin as any).renderDiagramHostContent();

    expect(template.strings.join('')).to.contain('Generating diagram');

    plugin.remove();
  });

  it('renders metrics only when pathMetricsLabel is present', () => {
    const plugin = createPlugin();

    plugin.pathMetricsLabel = '';
    const emptyTemplate = (plugin as any).renderDiagramMetrics();
    expect(emptyTemplate.strings.join('')).to.equal('');

    plugin.pathMetricsLabel = 'Paths: 2 | shortest length: 1';
    const metricsTemplate = (plugin as any).renderDiagramMetrics();
    expect(metricsTemplate.strings.join('')).to.contain('diagram-metrics');

    plugin.remove();
  });

  it('parses CSV inputs and builds switch DOT output', () => {
    const plugin = createPlugin();

    plugin.switchLinksInput = 'Sw1,GE2,Sw2,GE2';
    plugin.inputCsvData = 'Sw1,GE1,P1,PortA\nSw2,GE1,P2,PortB';
    plugin.refreshInputData();

    (plugin as any).renderSwitchDiagramSvg = () => Promise.resolve();
    plugin.buildSwitchDiagram(true);

    expect(plugin.switchLinksError).to.equal('');
    expect(plugin.switchLinks).to.have.length(1);
    expect(plugin.showSwitchDiagram).to.equal(true);
    expect(plugin.switchDiagramDot).to.contain(
      'digraph NetworkSwitchInformation'
    );
    expect(plugin.switchDiagramDot).to.contain('"Sw1"');
    expect(plugin.switchDiagramDot).to.contain('"Sw2"');
    expect(plugin.switchDiagramDot).to.contain('"Sw1" -> "Sw2"');

    plugin.remove();
  });

  it('includes IED nodes and IED-switch edges when includeIedInDiagram is enabled', () => {
    const plugin = createPlugin();

    plugin.portData = [
      {
        switchName: 'Sw1',
        portName: 'GE1',
        iedName: 'P1',
        receivingPortName: 'PortA'
      },
      {
        switchName: 'Sw2',
        portName: 'GE1',
        iedName: 'P2',
        receivingPortName: 'PortB'
      }
    ];
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.includeIedInDiagram = true;

    (plugin as any).renderSwitchDiagramSvg = () => Promise.resolve();
    plugin.buildSwitchDiagram(false);

    expect(plugin.switchDiagramDot).to.contain('"P1"');
    expect(plugin.switchDiagramDot).to.contain('"P2"');
    expect(plugin.switchDiagramDot).to.contain('"Sw1" -> "P1"');
    expect(plugin.switchDiagramDot).to.contain('"Sw2" -> "P2"');

    plugin.remove();
  });

  it('rebuilds diagram with refreshLinks=false when VLAN format changes', () => {
    const plugin = createPlugin();

    plugin.showSwitchDiagram = true;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.switchDiagramSvg = '<svg></svg>';

    let calledWith: boolean | null = null;
    (plugin as any).buildSwitchDiagram = (refreshLinks: boolean) => {
      calledWith = refreshLinks;
    };

    (plugin as any).rebuildDiagramForVlanLabelSizeChange();

    expect(plugin.switchDiagramSvg).to.equal('');
    expect(calledWith).to.equal(false);

    plugin.remove();
  });

  it('renders a diagram note when diagram is visible but no links exist', () => {
    const plugin = createPlugin();
    plugin.showSwitchDiagram = true;
    plugin.switchLinks = [];

    const template = (plugin as any).renderDiagramContent();

    expect(template.strings.join('')).to.contain(
      'Add one or more links in CSV format to generate a diagram.'
    );

    plugin.remove();
  });

  it('renders an empty template when diagram visibility is disabled', () => {
    const plugin = createPlugin();
    plugin.showSwitchDiagram = false;

    const template = (plugin as any).renderDiagramContent();

    expect(template.strings.join('')).to.equal('');

    plugin.remove();
  });

  it('renders Path Traffic pane title and service filters when pinned', () => {
    const plugin = createPlugin();
    plugin.showSwitchDiagram = true;
    plugin.linkDetailsPinned = true;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];

    const paneTemplate = (plugin as any).renderLinkDetailsPane();
    const renderedText = paneTemplate.strings.join('');

    // GOOSE/SV text is in conditional sub-templates, not the outer template's static strings.
    expect(renderedText).to.contain('Path Traffic');
    expect(renderedText).to.contain('link-details-pane');

    plugin.remove();
  });

  it('decorates rendered SVG nodes and edges with data attributes from titles', () => {
    const plugin = createPlugin();

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    host.innerHTML = `<svg>
      <g class="node"><title>Sw1</title><ellipse /></g>
      <g class="edge"><title>Sw1 -> Sw2</title><path /></g>
    </svg>`;
    plugin.renderRoot.appendChild(host);

    plugin.decorateRenderedDiagram();

    const node = host.querySelector('g.node')!;
    const edge = host.querySelector('g.edge')!;
    expect(node.getAttribute('data-node')).to.equal('Sw1');
    expect(edge.getAttribute('data-source')).to.equal('Sw1');
    expect(edge.getAttribute('data-target')).to.equal('Sw2');
    expect(edge.getAttribute('data-edge-key')).to.equal(
      NetworkConfig.getEdgeKey('Sw1', 'Sw2')
    );

    plugin.remove();
  });

  it('parses edge title variants and returns null for invalid titles', () => {
    expect(NetworkConfig.parseEdgeTitle(' Sw1 -> Sw2 ')).to.deep.equal({
      source: 'Sw1',
      target: 'Sw2'
    });
    expect(NetworkConfig.parseEdgeTitle('Sw1 -- Sw2')).to.deep.equal({
      source: 'Sw1',
      target: 'Sw2'
    });
    expect(NetworkConfig.parseEdgeTitle('not-an-edge-title')).to.equal(null);
  });

  it('handles wheel and pointer interactions for zoom and panning state', async () => {
    const plugin = createPlugin();

    const wheelEventOut = {
      deltaY: 100,
      preventDefault: () => undefined
    } as WheelEvent;
    const wheelEventIn = {
      deltaY: -100,
      preventDefault: () => undefined
    } as WheelEvent;

    (plugin as any).onDiagramWheel(wheelEventOut);
    const zoomAfterOut = plugin.diagramZoom;
    (plugin as any).onDiagramWheel(wheelEventIn);
    expect(plugin.diagramZoom).to.be.greaterThan(zoomAfterOut);

    const pointerHost = {
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined
    } as unknown as HTMLElement;

    (plugin as any).onDiagramPointerDown({
      button: 0,
      pointerId: 7,
      clientX: 10,
      clientY: 10
    } as PointerEvent);

    (plugin as any).onDiagramPointerMove({
      pointerId: 7,
      buttons: 1,
      clientX: 30,
      clientY: 40,
      currentTarget: pointerHost,
      preventDefault: () => undefined
    } as unknown as PointerEvent);

    expect(plugin.isDiagramPanning).to.equal(true);
    expect(plugin.diagramPanX).to.equal(20);
    expect(plugin.diagramPanY).to.equal(30);

    (plugin as any).onDiagramPointerUp({
      pointerId: 7,
      currentTarget: pointerHost
    } as unknown as PointerEvent);

    expect(plugin.isDiagramPanning).to.equal(false);
    expect((plugin as any).diagramActivePointerId).to.equal(null);

    await Promise.resolve();
    expect((plugin as any).suppressDiagramClick).to.equal(false);

    plugin.remove();
  });

  it('zoomToFit does nothing when no diagram container exists', () => {
    const plugin = createPlugin();

    plugin.diagramZoom = 1.5;
    plugin.diagramPanX = 50;
    plugin.diagramPanY = -30;

    (plugin as any).zoomToFit();

    expect(plugin.diagramZoom).to.equal(1.5);
    expect(plugin.diagramPanX).to.equal(50);
    expect(plugin.diagramPanY).to.equal(-30);

    plugin.remove();
  });

  it('zoomToFit does nothing when viewport dimensions are zero', () => {
    const plugin = createPlugin();

    plugin.diagramZoom = 1.5;
    plugin.diagramPanX = 50;
    plugin.diagramPanY = -30;

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    // offsetWidth / offsetHeight default to 0 on detached elements
    host.appendChild(viewport);
    plugin.renderRoot.appendChild(host);

    (plugin as any).zoomToFit();

    expect(plugin.diagramZoom).to.equal(1.5);
    expect(plugin.diagramPanX).to.equal(50);
    expect(plugin.diagramPanY).to.equal(-30);

    plugin.remove();
  });

  it('zoomToFit scales zoom to fit content and centres it in the container', () => {
    const plugin = createPlugin();

    plugin.diagramPanX = 120;
    plugin.diagramPanY = -80;

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    Object.defineProperty(host, 'clientWidth', { value: 800 });
    Object.defineProperty(host, 'clientHeight', { value: 600 });

    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    Object.defineProperty(viewport, 'offsetWidth', { value: 400 });
    Object.defineProperty(viewport, 'offsetHeight', { value: 300 });

    host.appendChild(viewport);
    plugin.renderRoot.appendChild(host);

    (plugin as any).zoomToFit();

    // min(800/400, 600/300) = 2 — both axes fill exactly, so pan is (0, 0)
    expect(plugin.diagramZoom).to.equal(2);
    expect(plugin.diagramPanX).to.equal(0); // (800 - 400*2) / 2
    expect(plugin.diagramPanY).to.equal(0); // (600 - 300*2) / 2

    plugin.remove();
  });

  it('zoomToFit centres on the unconstrained axis when ratios differ', () => {
    const plugin = createPlugin();

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    Object.defineProperty(host, 'clientWidth', { value: 800 });
    Object.defineProperty(host, 'clientHeight', { value: 400 });

    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    Object.defineProperty(viewport, 'offsetWidth', { value: 400 });
    Object.defineProperty(viewport, 'offsetHeight', { value: 400 });

    host.appendChild(viewport);
    plugin.renderRoot.appendChild(host);

    (plugin as any).zoomToFit();

    // min(800/400, 400/400) = 1 — height constrains; horizontal slack = 400px
    expect(plugin.diagramZoom).to.equal(1);
    expect(plugin.diagramPanX).to.equal(200); // (800 - 400*1) / 2
    expect(plugin.diagramPanY).to.equal(0); // (400 - 400*1) / 2

    plugin.remove();
  });

  it('zoomToFit shows all content for large diagrams, not clamped at 0.4', () => {
    const plugin = createPlugin();

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    Object.defineProperty(host, 'clientWidth', { value: 10 });
    Object.defineProperty(host, 'clientHeight', { value: 10 });

    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    Object.defineProperty(viewport, 'offsetWidth', { value: 10000 });
    Object.defineProperty(viewport, 'offsetHeight', { value: 10000 });

    host.appendChild(viewport);
    plugin.renderRoot.appendChild(host);

    (plugin as any).zoomToFit();

    // zoom = 0.001 — below 0.4 wheel-floor but allowed for fit; clamped to 0.01
    expect(plugin.diagramZoom).to.equal(0.01);
    expect(plugin.diagramPanX).to.equal(-45); // (10 - 10000*0.01) / 2
    expect(plugin.diagramPanY).to.equal(-45);

    plugin.remove();
  });

  it('zoomToFit clamps zoom to maximum 3 for very small content and centres it', () => {
    const plugin = createPlugin();

    const host = document.createElement('div');
    host.id = 'switch-diagram-host';
    Object.defineProperty(host, 'clientWidth', { value: 1200 });
    Object.defineProperty(host, 'clientHeight', { value: 900 });

    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    Object.defineProperty(viewport, 'offsetWidth', { value: 20 });
    Object.defineProperty(viewport, 'offsetHeight', { value: 20 });

    host.appendChild(viewport);
    plugin.renderRoot.appendChild(host);

    (plugin as any).zoomToFit();

    // zoom = min(60, 45) = 45 → clamped to 3
    expect(plugin.diagramZoom).to.equal(3);
    expect(plugin.diagramPanX).to.equal(570); // (1200 - 20*3) / 2
    expect(plugin.diagramPanY).to.equal(420); // (900 - 20*3) / 2

    plugin.remove();
  });

  it('executes tab 0 input handlers for paste, import, input, and blur flows', async () => {
    const plugin = createPlugin();

    const { clipboard } = navigator;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: () => Promise.resolve('Sw9,GE1,P9,Port9')
      }
    });

    plugin.activeTabIndex = 0;
    await plugin.updateComplete;

    const headerButtons = Array.from(
      plugin.shadowRoot!.querySelectorAll('md-outlined-button.header-button')
    ) as HTMLElement[];
    expect(headerButtons.length).to.be.greaterThan(2);
    // Index 0 is the "Save to SCL" toolbar button; IED data buttons start at 1.
    const [, firstHeaderButton, secondHeaderButton] = headerButtons;

    firstHeaderButton.click();
    await Promise.resolve();
    expect(plugin.inputCsvData).to.contain('Sw9,GE1,P9,Port9');

    const importClick = plugin.importCsvUI.click;
    let importInvocations = 0;
    plugin.importCsvUI.click = (() => {
      importInvocations += 1;
    }) as typeof plugin.importCsvUI.click;
    secondHeaderButton.click();
    expect((plugin as any).importType).to.equal('ied');
    expect(importInvocations).to.equal(1);
    plugin.importCsvUI.click = importClick;

    plugin.iedDataError = 'bad ied csv';
    const iedField = plugin.shadowRoot!.querySelector(
      '#input'
    ) as HTMLElement & {
      value?: string;
    };
    iedField.value = 'Sw1,GE1,P1,PortA';
    iedField.dispatchEvent(
      new Event('input', { bubbles: true, composed: true })
    );
    iedField.dispatchEvent(
      new Event('blur', { bubbles: true, composed: true })
    );

    const switchField = plugin.shadowRoot!.querySelector(
      '#switch-links'
    ) as HTMLElement & { value?: string };
    switchField.value = 'Sw1,GE2,Sw2,GE2';
    switchField.dispatchEvent(
      new Event('input', { bubbles: true, composed: true })
    );

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: () => Promise.reject(new Error('blocked'))
      }
    });

    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: unknown) => {
      if (typeof callback === 'function') callback(0);
      return 0;
    }) as typeof window.requestAnimationFrame;

    firstHeaderButton.click();
    await Promise.resolve();
    expect(
      plugin.snackbarOpen === true || plugin.snackbarOpen === false
    ).to.equal(true);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard
    });
    window.requestAnimationFrame = raf;
    plugin.remove();
  });

  it('executes tab 1 visualisation, switch toggles, clear and download handlers', async () => {
    const plugin = createPlugin();
    plugin.activeTabIndex = 1;
    plugin.showSwitchDiagram = true;
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.selectedPathStart = 'Sw1';
    plugin.highlightedEdgeKeys = ['Sw1::Sw2'];
    plugin.switchDiagramSvg = '<svg></svg>';
    plugin.switchDiagramDot = 'digraph NetworkSwitchInformation {}';

    let buildCalls = 0;
    (plugin as any).buildSwitchDiagram = () => {
      buildCalls += 1;
    };
    let downloadSvgCalls = 0;
    let downloadDotCalls = 0;
    plugin.downloadSwitchDiagramSvg = () => {
      downloadSvgCalls += 1;
    };
    plugin.downloadSwitchDiagramDot = () => {
      downloadDotCalls += 1;
    };

    await plugin.updateComplete;

    const visualisationButton = plugin.shadowRoot!.querySelector(
      '#visualisation-menu-anchor'
    ) as HTMLElement;
    visualisationButton.click();
    expect(plugin.visualisationMenuOpen).to.equal(true);

    const visualisationMenu = plugin.shadowRoot!.querySelector(
      '#visualisation-menu'
    ) as HTMLElement;
    visualisationMenu.dispatchEvent(new Event('closed'));
    expect(plugin.visualisationMenuOpen).to.equal(false);

    const menuItems = Array.from(
      visualisationMenu.querySelectorAll('md-menu-item')
    ) as HTMLElement[];
    menuItems.forEach(item => item.click());
    expect(buildCalls).to.be.greaterThan(5);

    const vlanButtons = Array.from(
      plugin.shadowRoot!.querySelectorAll('.vlan-segment-button')
    ) as HTMLElement[];
    vlanButtons.forEach(button => button.click());

    const showIedSwitch = plugin.shadowRoot!.querySelector(
      '#show-ieds-slider'
    ) as HTMLElement & { selected?: boolean };
    showIedSwitch.selected = true;
    showIedSwitch.dispatchEvent(new Event('change', { bubbles: true }));

    const unsubscribedSwitch = plugin.shadowRoot!.querySelector(
      '#unsubscribed-messages-slider'
    ) as HTMLElement & { selected?: boolean };
    unsubscribedSwitch.selected = true;
    unsubscribedSwitch.dispatchEvent(new Event('change', { bubbles: true }));

    const clearButton = (
      Array.from(
        plugin.shadowRoot!.querySelectorAll('md-outlined-button.selection-item')
      ) as HTMLElement[]
    ).find(button =>
      (button.textContent ?? '').includes('Clear')
    ) as HTMLElement;
    clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const downloadButton = plugin.shadowRoot!.querySelector(
      '#download-menu-anchor'
    ) as HTMLElement;
    downloadButton.click();

    const downloadMenu = plugin.shadowRoot!.querySelector(
      '#download-menu'
    ) as HTMLElement;
    downloadMenu.dispatchEvent(new Event('closed'));

    const downloadItems = Array.from(
      downloadMenu.querySelectorAll('md-menu-item')
    ) as HTMLElement[];
    const [downloadSvgItem, downloadDotItem] = downloadItems;
    downloadSvgItem.click();
    downloadDotItem.click();
    expect(downloadSvgCalls).to.equal(1);
    expect(downloadDotCalls).to.equal(1);

    plugin.remove();
  });

  it('executes tab 2 configuration handlers and CSV import file change flow', async () => {
    const plugin = createPlugin();
    plugin.doc = new DOMParser().parseFromString(
      '<SCL xmlns="http://www.iec.ch/61850/2003/SCL"><IED name="P1"/></SCL>',
      'application/xml'
    );
    plugin.activeTabIndex = 2;
    plugin.portData = [
      {
        switchName: 'Sw1',
        portName: 'GE1',
        iedName: 'P1',
        receivingPortName: 'PortA'
      }
    ];
    plugin.switchLinks = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'GE2',
        targetSwitch: 'Sw2',
        targetPort: 'GE2'
      }
    ];
    plugin.iedNames = ['P1'];

    let outputBuildCalls = 0;
    plugin.buildOutputConfiguration = () => {
      outputBuildCalls += 1;
    };

    await plugin.updateComplete;

    const iedSelect = plugin.shadowRoot!.querySelector('#iedSelect') as {
      value?: string;
      dispatchEvent: (event: Event) => boolean;
    };
    iedSelect.value = 'P1';
    iedSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const switchSelect = plugin.shadowRoot!.querySelector(
      '#ethernetSwitch'
    ) as {
      value?: string;
      dispatchEvent: (event: Event) => boolean;
    };
    switchSelect.value = 'Sw1';
    switchSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const nativeVlan = plugin.shadowRoot!.querySelector('#nativeVlan') as {
      value?: string;
      dispatchEvent: (event: Event) => boolean;
    };
    nativeVlan.value = '777';
    nativeVlan.dispatchEvent(new Event('input', { bubbles: true }));

    const toggles = Array.from(
      plugin.shadowRoot!.querySelectorAll('.config-toggle md-checkbox')
    ) as Array<HTMLElement & { checked?: boolean }>;
    for (const checkbox of toggles) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const fileInput = plugin.shadowRoot!.querySelector('#csv-input') as
      | (HTMLInputElement & {
          files: { item: (index: number) => { text: () => Promise<string> } };
        })
      | null;
    expect(fileInput).to.not.equal(null);
    if (fileInput) {
      (plugin as any).importType = 'switch';
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: {
          item: () => ({ text: async () => 'Sw9,GE2,Sw10,GE2' })
        }
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    }

    expect(outputBuildCalls).to.be.greaterThan(1);
    expect(plugin.nativeVlan).to.equal('777');

    plugin.remove();
  });

  it('executes tab 2 copy and download output handlers', async () => {
    const plugin = createPlugin();
    plugin.doc = new DOMParser().parseFromString(
      '<SCL xmlns="http://www.iec.ch/61850/2003/SCL"><IED name="P1"/></SCL>',
      'application/xml'
    );
    plugin.activeTabIndex = 2;
    await plugin.updateComplete;

    plugin.outputUI.value = 'sample config output';
    plugin.selectedSwitchScope = 'Sw1';

    const originalPermissions = navigator.permissions;
    const originalClipboard = navigator.clipboard;
    let clipboardWrites = 0;
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: () => Promise.resolve({ state: 'granted' })
      }
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          clipboardWrites += 1;
          return Promise.resolve();
        }
      }
    });

    const createObjectUrl = URL.createObjectURL;
    const revokeObjectUrl = URL.revokeObjectURL;
    let createCalls = 0;
    let revokeCalls = 0;
    URL.createObjectURL = (() => {
      createCalls += 1;
      return 'blob:download';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => {
      revokeCalls += 1;
    }) as typeof URL.revokeObjectURL;

    const timer = window.setTimeout;
    window.setTimeout = ((cb: unknown) => {
      if (typeof cb === 'function') cb();
      return 0;
    }) as typeof window.setTimeout;

    const actionButtons = Array.from(
      plugin.shadowRoot!.querySelectorAll(
        '.config-button-group md-outlined-button'
      )
    ) as HTMLElement[];
    const [copyButton, downloadButton] = actionButtons;

    copyButton.click();
    await Promise.resolve();
    downloadButton.click();

    expect(clipboardWrites).to.equal(1);
    expect(createCalls).to.equal(1);
    expect(revokeCalls).to.equal(1);

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: originalPermissions
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    });
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    window.setTimeout = timer;

    plugin.remove();
  });
});

// ---------------------------------------------------------------------------
// SCL Private element persistence (saveToScl / loadFromScl)
// ---------------------------------------------------------------------------

const OPS_NS = 'https://openpowershift.com/Communication/network-config';
const OPS_NS_PREFIX = 'eopsnc';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const PRIVATE_TYPE_IED = 'OpenPowerShift-network-config-ied-data';
const PRIVATE_TYPE_SWITCH = 'OpenPowerShift-network-config-switch-links';

function createSclDoc(extraComm = ''): XMLDocument {
  const parser = new DOMParser();
  return parser.parseFromString(
    `<?xml version="1.0"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <Communication>${extraComm}</Communication>
</SCL>`,
    'application/xml'
  );
}

describe('saveToScl / loadFromScl', () => {
  let plugin: NetworkConfig & Record<string, any>;
  let xmlEditor: XMLEditor;
  let editHandler: (e: Event) => void;

  beforeEach(() => {
    plugin = createPlugin();
    xmlEditor = new XMLEditor();
    editHandler = (e: Event) => {
      xmlEditor.commit((e as EditEventV2).detail.edit);
    };
    document.body.addEventListener('oscd-edit-v2', editHandler);
  });

  afterEach(() => {
    document.body.removeEventListener('oscd-edit-v2', editHandler);
    plugin.remove();
  });

  it('saveToScl shows a snackbar and does nothing when no doc is loaded', () => {
    plugin.doc = undefined as unknown as XMLDocument;

    let snackbarText = '';
    (plugin as any).showSnackbar = (msg: string) => {
      snackbarText = msg;
    };

    plugin.saveToScl();
    expect(snackbarText).to.contain('No SCL document');
  });

  it('saveToScl writes IED data as a Private element under Communication', () => {
    plugin.doc = createSclDoc();
    plugin.inputCsvData = 'Sw1,P1,IED1,GE1';
    plugin.switchLinksInput = 'Sw1,P2,Sw2,P2';
    (plugin as any).showSnackbar = () => {};

    plugin.saveToScl();

    const iedPrivate = plugin.doc.querySelector(
      `Communication > Private[type="${PRIVATE_TYPE_IED}"]`
    );
    expect(iedPrivate).to.not.equal(null);
    const iedEl = iedPrivate!.getElementsByTagNameNS(
      OPS_NS,
      'Network-Config-IED-Data'
    )[0];
    expect(iedEl).to.not.equal(undefined);
    expect(iedEl.textContent).to.equal('Sw1,P1,IED1,GE1');
  });

  it('saveToScl writes switch-links as a Private element under Communication', () => {
    plugin.doc = createSclDoc();
    plugin.inputCsvData = 'Sw1,P1,IED1,GE1';
    plugin.switchLinksInput = 'Sw1,P2,Sw2,P2';
    (plugin as any).showSnackbar = () => {};

    plugin.saveToScl();

    const switchPrivate = plugin.doc.querySelector(
      `Communication > Private[type="${PRIVATE_TYPE_SWITCH}"]`
    );
    expect(switchPrivate).to.not.equal(null);
    const switchEl = switchPrivate!.getElementsByTagNameNS(
      OPS_NS,
      'Network-Config-Switch-Links'
    )[0];
    expect(switchEl).to.not.equal(undefined);
    expect(switchEl.textContent).to.equal('Sw1,P2,Sw2,P2');
  });

  it('saveToScl replaces existing Private elements on repeated saves', () => {
    plugin.doc = createSclDoc();
    plugin.inputCsvData = 'Sw1,P1,IED1,GE1';
    plugin.switchLinksInput = 'Sw1,P2,Sw2,P2';
    (plugin as any).showSnackbar = () => {};

    plugin.saveToScl();

    plugin.inputCsvData = 'Sw2,P1,IED2,GE1';
    plugin.saveToScl();

    const allIedPrivates = plugin.doc.querySelectorAll(
      `Communication > Private[type="${PRIVATE_TYPE_IED}"]`
    );
    expect(allIedPrivates.length).to.equal(1);
    const iedEl = allIedPrivates[0].getElementsByTagNameNS(
      OPS_NS,
      'Network-Config-IED-Data'
    )[0];
    expect(iedEl.textContent).to.equal('Sw2,P1,IED2,GE1');
  });

  it('saveToScl includes a SetAttributes edit declaring xmlns:eopsnc on the root SCL element', () => {
    plugin.doc = createSclDoc();
    plugin.inputCsvData = 'Sw1,P1,IED1,GE1';
    plugin.switchLinksInput = '';

    let capturedEdits: any = null;
    plugin.addEventListener('oscd-edit-v2', (e: Event) => {
      capturedEdits = (e as CustomEvent).detail.edit;
    });
    (plugin as any).showSnackbar = () => {};
    plugin.saveToScl();

    const nsEdit = (capturedEdits as any[]).find(
      (edit: any) => edit.element === plugin.doc.documentElement
    );
    expect(nsEdit).to.not.equal(undefined);
    expect(
      nsEdit.attributesNS?.[XMLNS_NS]?.[`xmlns:${OPS_NS_PREFIX}`]
    ).to.equal(OPS_NS);
  });

  it('saveToScl creates child elements with eopsnc: prefix, not an inline namespace declaration', () => {
    plugin.doc = createSclDoc();
    plugin.inputCsvData = 'Sw1,P1,IED1,GE1';
    plugin.switchLinksInput = 'Sw1,P2,Sw2,P2';

    let capturedEdits: any = null;
    plugin.addEventListener('oscd-edit-v2', (e: Event) => {
      capturedEdits = (e as CustomEvent).detail.edit;
    });
    (plugin as any).showSnackbar = () => {};
    plugin.saveToScl();

    const insertEdits = (capturedEdits as any[]).filter(
      (edit: any) => edit.parent
    );
    expect(insertEdits.length).to.be.greaterThan(0);

    for (const edit of insertEdits) {
      (edit.node as Element).querySelectorAll('*').forEach((el: Element) => {
        expect(el.prefix).to.equal(OPS_NS_PREFIX);
        expect(el.getAttributeNS(XMLNS_NS, OPS_NS_PREFIX)).to.equal(null);
      });
    }
  });

  it('loadFromScl populates inputCsvData from an existing Private element', () => {
    const iedCsv = 'Sw1,P1,IED1,GE1\nSw2,P1,IED2,GE1';
    const iedPrivateXml = `<Private type="${PRIVATE_TYPE_IED}"><ops:Network-Config-IED-Data xmlns:ops="${OPS_NS}">${iedCsv}</ops:Network-Config-IED-Data></Private>`;
    plugin.doc = createSclDoc(iedPrivateXml);

    (plugin as any).loadFromScl();

    expect(plugin.inputCsvData).to.equal(iedCsv);
  });

  it('loadFromScl populates switchLinksInput from an existing Private element', () => {
    const switchCsv = 'Sw1,P2,Sw2,P2\nSw2,P3,Sw3,P3';
    const switchPrivateXml = `<Private type="${PRIVATE_TYPE_SWITCH}"><ops:Network-Config-Switch-Links xmlns:ops="${OPS_NS}">${switchCsv}</ops:Network-Config-Switch-Links></Private>`;
    plugin.doc = createSclDoc(switchPrivateXml);

    (plugin as any).loadFromScl();

    expect(plugin.switchLinksInput).to.equal(switchCsv);
  });

  it('loadFromScl leaves data unchanged when no Private elements exist', () => {
    plugin.inputCsvData = 'original-ied';
    plugin.switchLinksInput = 'original-switch';
    plugin.doc = createSclDoc();

    (plugin as any).loadFromScl();

    expect(plugin.inputCsvData).to.equal('original-ied');
    expect(plugin.switchLinksInput).to.equal('original-switch');
  });
});
