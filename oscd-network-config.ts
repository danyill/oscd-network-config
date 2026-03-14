import { LitElement, PropertyValues, TemplateResult, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { instance, type Viz } from '@viz-js/viz';

import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/filled-select.js';
import '@material/web/select/select-option.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/icon/icon.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/switch/switch.js';
import '@material/mwc-snackbar';
import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import { getReference } from '@openscd/scl-lib';
import type { EditV2 } from '@openscd/oscd-api';
import type { TextField } from '@material/web/textfield/internal/text-field.js';

import { getUsedCBs } from './foundation/getUsedCBs.js';
import {
  buildIedTrafficIndex,
  getIedNames,
  getPublishedTrafficByIed,
  getSubscribedTrafficByIed,
  type SubscribedTrafficEntry
} from './foundation/sclTraffic.js';
import {
  validateIedCsv,
  validateSwitchLinksCsv,
  validateCrossDatasets
} from './foundation/csvValidation.js';
import { calculateAndHighlightPaths } from './foundation/switchRouting.js';
import {
  buildSwitchDiagramModel,
  type DiagramEdge,
  type DiagramThemeColors
} from './foundation/buildDiagram.js';
import {
  buildCiscoConfigurationText,
  buildRuggedcomConfigurationText
} from './foundation/buildSwitchConfigurations.js';

const defaultIedData = ``;

// Sw1,Port1,P1,Port 5
// Sw2,Port1,P2,Port F
// Sw3,Port1,MU1,Port 5
// Sw4,Port1,MU2,Port 5`;

const defaultSwitchLinks = ``;

// Sw1,Port2,Sw2,Port2
// Sw3,Port2,Sw4,Port2
// Sw2,Port3,Sw4,Port3`;

const ALL_SWITCHES_OPTION = '__ALL_SWITCHES__';

type SwitchLink = {
  sourceSwitch: string;
  sourcePort: string;
  targetSwitch: string;
  targetPort: string;
};

type LinkTrafficEntry = {
  senderIed: string;
  receiverIed: string;
  serviceType: 'GOOSE' | 'SV';
  controlBlockName: string;
  vlan: number;
  mac: string;
  senderSwitch: string;
  receiverSwitch: string;
};

type LinkTrafficGroup = {
  senderIed: string;
  receiverIed: string;
  gooseEntries: LinkTrafficEntry[];
  svEntries: LinkTrafficEntry[];
};

type LinkTrafficCandidate = {
  entry: LinkTrafficEntry;
  edgeKeys: Set<string>;
  senderSwitch: string;
  receiverSwitch: string;
};

/**
 * A plugin which supplements data in the Communication section
 * to show subscribing data for GSE and SMV addresses.
 */

// Set to true during development to show path count / length / hops overlay.
const SHOW_PATH_DEBUG_METRICS = false;

export default class NetworkConfig extends LitElement {
  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  @property({ attribute: false })
  docName!: string;

  @property({ attribute: false })
  docVersion!: string;

  @property({ attribute: false })
  prpNetwork: 'A' | 'B' = 'A';

  @property({ attribute: false })
  protectionSystem: '1' | '2' = '1';

  @property({ attribute: false })
  nativeVlan: string = '1000';

  @property({ attribute: false })
  inputCsvData: string = defaultIedData;

  @property({ attribute: false })
  substation: string = '';

  @property({ attribute: false })
  portData:
    | {
        switchName: string;
        portName: string;
        iedName: string;
        receivingPortName: string;
      }[]
    | null = null;

  @property({ attribute: false })
  switchNames: string[] = [];

  @property({ attribute: false })
  iedNames: string[] = [];

  @property({ attribute: false })
  switchLinks: SwitchLink[] = [];

  @property({ attribute: false })
  switchLinksInput: string = defaultSwitchLinks;

  @property({ attribute: false })
  switchDiagramDot: string = '';

  @property({ attribute: false })
  showSwitchDiagram: boolean = false;

  @property({ attribute: false })
  includeIedInDiagram: boolean = false;

  @property({ attribute: false })
  diagramLayout: string = 'dot';

  @property({ attribute: false })
  edgeRouting: string = 'ortho';

  @property({ attribute: false })
  diagramSpacing: string = 'normal';

  @property({ attribute: false })
  vlanLabelFormat: 'dec' | 'hex' = 'dec';

  @property({ attribute: false })
  activeTabIndex: number = 0;

  @property({ attribute: false })
  diagramZoom: number = 1;

  @property({ attribute: false })
  diagramPanX: number = 0;

  @property({ attribute: false })
  diagramPanY: number = 0;

  @property({ attribute: false })
  isDiagramPanning: boolean = false;

  @property({ attribute: false })
  switchDiagramSvg: string = '';

  @property({ attribute: false })
  switchDiagramError: string = '';

  @property({ attribute: false })
  selectedPathStart: string = '';

  @property({ attribute: false })
  selectedPathEnd: string = '';

  @property({ attribute: false })
  highlightedEdgeKeys: string[] = [];

  @property({ attribute: false })
  highlightedShortestEdgeKeys: string[] = [];

  @property({ attribute: false })
  highlightedNodes: string[] = [];

  @property({ attribute: false })
  pathTooltip: string = '';

  @property({ attribute: false })
  pathSelectionSummary: string = '';

  @property({ attribute: false })
  pathMetricsLabel: string = '';

  @property({ attribute: false })
  selectedLinkEdgeKey: string = '';

  @property({ attribute: false })
  selectedLinkSource: string = '';

  @property({ attribute: false })
  selectedLinkTarget: string = '';

  @property({ attribute: false })
  linkDetailsPinned: boolean = false;

  @property({ attribute: false })
  showGooseTraffic: boolean = true;

  @property({ attribute: false })
  showSvTraffic: boolean = true;

  @property({ attribute: false })
  iedDataError: string = '';

  @property({ attribute: false })
  switchLinksError: string = '';

  @property({ attribute: false })
  crossDatasetError: string = '';

  @property({ attribute: false })
  unusedIedCount: number = 0;

  @property({ attribute: false })
  snackbarMessage: string = '';

  @property({ attribute: false })
  snackbarOpen: boolean = false;

  @property({ attribute: false })
  onlyConfigureIedPorts: boolean = false;

  @property({ attribute: false })
  configureSingleIedConnectivity: boolean = false;

  @property({ attribute: false })
  includePeerIedPortsForSingleIed: boolean = false;

  @property({ attribute: false })
  includeUnsubscribedMessages: boolean = false;

  @property({ attribute: false })
  selectedIedName: string = 'All IEDs';

  @property({ attribute: false })
  selectedSwitchScope: string = ALL_SWITCHES_OPTION;

  @property({ attribute: false })
  switchVendor: string = 'cisco';

  @property({ attribute: false })
  visualisationMenuOpen: boolean = false;

  @property({ attribute: false })
  downloadMenuOpen: boolean = false;

  @property({ attribute: false })
  usedControlBlocks: Map<Element, string[]> | null = null;

  private vizInstancePromise: Promise<Viz> | null = null;

  private diagramRenderVersion: number = 0;

  private diagramGraphEdges: DiagramEdge[] = [];

  private edgeLabelByKey: Map<string, string> = new Map();

  private _iedToSwitchCache: Map<string, string> | null = null;

  private _switchAdjacencyCache: Map<string, Set<string>> | null = null;

  private _switchPathCache: Map<string, string[]> = new Map();

  private _controlBlockAddressCache: Map<
    Element,
    { mac: string; vlan: number }
  > = new Map();

  private _linkTrafficCandidatesCache: LinkTrafficCandidate[] | null = null;

  // Pre-built index from "iedName||cbName||serviceType" → {mac, vlan}.
  // Eliminates repeated querySelectorAll(':root > Communication …') inside
  // getControlBlockAddress() — one DOM scan per doc instead of one per CB.
  private _connectedApAddressIndex: Map<
    string,
    { mac: string; vlan: number }
  > | null = null;

  // Cached Set of all switch names (built from switchLinks + portData).
  private _switchNameIndexCache: Set<string> | null = null;

  private diagramPanStartX: number = 0;

  private diagramPanStartY: number = 0;

  private diagramPanStartOffsetX: number = 0;

  private diagramPanStartOffsetY: number = 0;

  private diagramPanMoved: boolean = false;

  private suppressDiagramClick: boolean = false;

  private diagramActivePointerId: number | null = null;

  private colorSchemeMediaQuery: MediaQueryList | null = null;

  private readonly handleColorSchemeChange = () => {
    if (!this.showSwitchDiagram || this.switchLinks.length === 0) return;
    this.buildSwitchDiagram(false);
  };

  private invalidateComputedCaches(): void {
    this._iedToSwitchCache = null;
    this._switchAdjacencyCache = null;
    this._switchPathCache.clear();
    this._controlBlockAddressCache.clear();
    this._linkTrafficCandidatesCache = null;
    this._connectedApAddressIndex = null;
    this._switchNameIndexCache = null;
  }

  private importType: 'ied' | 'switch' = 'ied';

  @query('#input')
  inputUI!: TextField;

  @query('#csv-input')
  importCsvUI!: HTMLInputElement;

  @query('#output')
  outputUI!: TextField;

  @query('#ethernetSwitch')
  ethernetSwitchUI!: TextField;

  @query('#iedSelect')
  iedSelectUI!: { value: string };

  @query('#nativeVlan')
  nativeVlanUI!: TextField;

  @query('#visualisation-menu-anchor')
  visualisationMenuAnchorUI!: HTMLElement;

  @query('#download-menu-anchor')
  downloadMenuAnchorUI!: HTMLElement;

  @query('#visualisation-menu')
  visualisationMenuUI!: HTMLElement;

  @query('#download-menu')
  downloadMenuUI!: HTMLElement;

  connectedCallback(): void {
    super.connectedCallback();

    if (typeof window === 'undefined' || !window.matchMedia) return;

    this.colorSchemeMediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );
    this.colorSchemeMediaQuery.addEventListener(
      'change',
      this.handleColorSchemeChange
    );
  }

  disconnectedCallback(): void {
    if (this.colorSchemeMediaQuery) {
      this.colorSchemeMediaQuery.removeEventListener(
        'change',
        this.handleColorSchemeChange
      );
      this.colorSchemeMediaQuery = null;
    }

    super.disconnectedCallback();
  }

  refreshInputData() {
    const validation = validateIedCsv(this.inputCsvData);
    if (validation.errors.length > 0) {
      const [firstError] = validation.errors;
      this.iedDataError = firstError;
      this.portData = null;
      this.switchNames = [];
      this.iedNames = [];
      this.updateUnusedIedCount();
      return;
    }

    this.iedDataError = '';
    this.portData = validation.rows;

    this.updateSwitchNames();
    this.updateIedNames();
    this.updateUnusedIedCount();

    if (
      this.showSwitchDiagram &&
      this.includeIedInDiagram &&
      this.switchLinks.length > 0
    ) {
      this.buildSwitchDiagram(false);
    }

    this.validateAcrossDatasets();
  }

  updateSwitchNames() {
    const switchesFromPorts = (this.portData ?? [])
      .map(port => port.switchName?.trim() ?? '')
      .filter(name => name !== '');

    const switchesFromLinks = this.switchLinks
      .flatMap(link => [link.sourceSwitch, link.targetSwitch])
      .map(name => name.trim())
      .filter(name => name !== '');

    this.switchNames = [
      ...new Set([...switchesFromPorts, ...switchesFromLinks])
    ].sort((a, b) => a.localeCompare(b));
  }

  updateIedNames() {
    this.iedNames = [
      ...new Set(
        (this.portData ?? [])
          .map(port => port.iedName?.trim() ?? '')
          .filter(name => name !== '')
      )
    ].sort((a, b) => a.localeCompare(b));

    const hasAllIedsSelection = this.selectedIedName === 'All IEDs';
    if (
      this.selectedIedName === '' ||
      (!hasAllIedsSelection && !this.iedNames.includes(this.selectedIedName))
    ) {
      this.selectedIedName = 'All IEDs';
    }

    // When switching to single-IED mode, update switch selection if needed
    if (
      this.configureSingleIedConnectivity &&
      this.selectedIedName !== '' &&
      this.selectedIedName !== 'All IEDs'
    ) {
      const availableSwitches = this.getAvailableSwitches();
      if (
        availableSwitches.length > 0 &&
        !availableSwitches.includes(this.selectedSwitchScope)
      ) {
        const [firstSwitch] = availableSwitches;
        if (firstSwitch) this.selectedSwitchScope = firstSwitch;
      }
    }
  }

  private updateUnusedIedCount() {
    if (!this.doc?.documentElement || !this.portData) {
      this.unusedIedCount = 0;
      return;
    }

    const sclIeds = new Set(getIedNames(this.doc));
    const networkIeds = new Set(
      this.portData
        .map(port => port.iedName?.trim() ?? '')
        .filter(name => name !== '')
    );

    let unused = 0;
    sclIeds.forEach(iedName => {
      if (!networkIeds.has(iedName)) unused += 1;
    });

    this.unusedIedCount = unused;
  }

  private showSnackbar(message: string) {
    if (message === '') return;
    // Close first to ensure snackbar reappears when error changes
    this.snackbarOpen = false;
    // Use requestAnimationFrame to reopen in next frame
    requestAnimationFrame(() => {
      this.snackbarMessage = message;
      this.snackbarOpen = true;
    });
  }

  private validateAcrossDatasets() {
    // Only check if both datasets have valid data
    if (
      !this.portData ||
      !this.switchLinks ||
      this.portData.length === 0 ||
      this.switchLinks.length === 0
    ) {
      this.crossDatasetError = '';
      return;
    }

    const crossErrors = validateCrossDatasets(this.portData, this.switchLinks);
    if (crossErrors.length > 0) {
      [this.crossDatasetError] = crossErrors;
    } else {
      this.crossDatasetError = '';
    }
  }

  refreshSwitchLinks() {
    const validation = validateSwitchLinksCsv(this.switchLinksInput);
    if (validation.errors.length > 0) {
      const [firstError] = validation.errors;
      this.switchLinksError = firstError;
      this.switchLinks = [];
      this.updateSwitchNames();
      return;
    }

    this.switchLinksError = '';
    this.switchLinks = validation.rows.filter(
      link =>
        link.sourceSwitch !== '' &&
        link.sourcePort !== '' &&
        link.targetSwitch !== '' &&
        link.targetPort !== ''
    );

    this.updateSwitchNames();

    if (this.showSwitchDiagram && this.switchLinks.length > 0) {
      this.buildSwitchDiagram(false);
    }

    if (this.showSwitchDiagram && this.switchLinks.length === 0) {
      this.switchDiagramSvg = '';
      this.switchDiagramDot = '';
      this.switchDiagramError = '';
    }

    this.validateAcrossDatasets();
  }

  private static resolveDiagramColor(
    style: CSSStyleDeclaration,
    variableName: string,
    fallback: string
  ): string {
    const value = style.getPropertyValue(variableName).trim();
    return value !== '' ? value : fallback;
  }

  private getDiagramThemeColors(): DiagramThemeColors {
    const style = getComputedStyle(this);
    const iedFontColorVariable = this.colorSchemeMediaQuery?.matches
      ? '--oscd-theme-base00'
      : '--oscd-theme-base3';

    return {
      graphBackground: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-base3',
        'transparent'
      ),
      switchNodeFill: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-base2',
        '#fed7aa'
      ),
      switchNodeStroke: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-secondary',
        '#ea580c'
      ),
      switchNodeFont: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-base00',
        '#1f2937'
      ),
      iedNodeFill: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-primary',
        '#335522'
      ),
      iedNodeStroke: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-secondary',
        '#1d4ed8'
      ),
      iedNodeFont: NetworkConfig.resolveDiagramColor(
        style,
        iedFontColorVariable,
        '#f8fafc'
      ),
      edgeStroke: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-secondary',
        '#1d4ed8'
      ),
      edgeFont: NetworkConfig.resolveDiagramColor(
        style,
        '--oscd-theme-base00',
        '#1f2937'
      ),
      // Strip CSS string quotes from the font name (e.g. "'Fira Sans'" → "Fira Sans")
      fontName:
        style
          .getPropertyValue('--oscd-theme-text-font')
          .trim()
          .replace(/^['"]|['"]$/g, '') || 'Roboto'
    };
  }

  buildSwitchDiagram(
    refreshLinks: boolean = true,
    preserveSelection: boolean = false
  ) {
    if (refreshLinks) this.refreshSwitchLinks();
    this.showSwitchDiagram = true;
    if (!preserveSelection) this.clearPathSelection();

    const hasDoc = !!this.doc?.documentElement;
    const rawPublished: Map<string, SubscribedTrafficEntry[]> = hasDoc
      ? getPublishedTrafficByIed(this.doc)
      : new Map<string, SubscribedTrafficEntry[]>();
    const rawSubscribed: Map<string, SubscribedTrafficEntry[]> = hasDoc
      ? getSubscribedTrafficByIed(this.usedControlBlocks)
      : new Map<string, SubscribedTrafficEntry[]>();

    const filterByService = (
      map: Map<string, SubscribedTrafficEntry[]>
    ): Map<string, SubscribedTrafficEntry[]> => {
      if (this.showGooseTraffic && this.showSvTraffic) return map;
      const allowed = new Set<string>();
      if (this.showGooseTraffic) allowed.add('0x88B8');
      if (this.showSvTraffic) allowed.add('0x88BA');
      const out = new Map<string, SubscribedTrafficEntry[]>();
      map.forEach((entries, ied) => {
        const filtered = entries.filter(e => allowed.has(e.ethType));
        if (filtered.length > 0) out.set(ied, filtered);
      });
      return out;
    };

    const publishedTrafficByIed = filterByService(rawPublished);
    const subscribedTrafficByIed = filterByService(rawSubscribed);

    const diagramModel = buildSwitchDiagramModel({
      switchLinks: this.switchLinks,
      portData: this.portData ?? [],
      includeIedInDiagram: this.includeIedInDiagram,
      includeUnsubscribedMessages: this.includeUnsubscribedMessages,
      diagramLayout: this.diagramLayout,
      edgeRouting: this.edgeRouting,
      diagramSpacing: this.diagramSpacing,
      vlanLabelFormat: this.vlanLabelFormat,
      publishedTrafficByIed,
      subscribedTrafficByIed,
      themeColors: this.getDiagramThemeColors()
    });

    this.switchDiagramDot = diagramModel.dot;
    this.diagramGraphEdges = diagramModel.diagramEdges;
    this.edgeLabelByKey = diagramModel.edgeLabelByKey;

    this.renderSwitchDiagramSvg();
  }

  private rebuildDiagramForVlanLabelSizeChange(): void {
    if (!this.showSwitchDiagram || this.switchLinks.length === 0) return;
    this.switchDiagramSvg = '';
    this.buildSwitchDiagram(false);
  }

  async renderSwitchDiagramSvg() {
    this.diagramRenderVersion += 1;
    const renderVersion = this.diagramRenderVersion;

    if (this.switchLinks.length === 0) {
      this.switchDiagramSvg = '';
      this.switchDiagramError = '';
      return;
    }

    this.switchDiagramError = '';
    this.switchDiagramSvg = '';

    try {
      if (!this.vizInstancePromise) {
        this.vizInstancePromise = instance();
      }

      const viz = await this.vizInstancePromise;
      const renderedSvg = viz.renderString(this.switchDiagramDot, {
        format: 'svg',
        engine: this.diagramLayout
      });

      if (renderVersion !== this.diagramRenderVersion) return;
      this.switchDiagramSvg = renderedSvg;
    } catch (error) {
      if (renderVersion !== this.diagramRenderVersion) return;
      this.switchDiagramSvg = '';
      this.switchDiagramError =
        error instanceof Error
          ? error.message
          : 'Unable to render Graphviz diagram.';
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (this.visualisationMenuUI && this.visualisationMenuAnchorUI) {
      (
        this.visualisationMenuUI as HTMLElement & {
          anchorElement?: HTMLElement | null;
        }
      ).anchorElement = this.visualisationMenuAnchorUI;
    }

    if (this.downloadMenuUI && this.downloadMenuAnchorUI) {
      (
        this.downloadMenuUI as HTMLElement & {
          anchorElement?: HTMLElement | null;
        }
      ).anchorElement = this.downloadMenuAnchorUI;
    }

    const dataInputsChanged =
      changed.has('doc') ||
      changed.has('docVersion') ||
      changed.has('portData') ||
      changed.has('switchLinks') ||
      changed.has('usedControlBlocks') ||
      changed.has('includeUnsubscribedMessages');

    if (dataInputsChanged) {
      this.invalidateComputedCaches();
    }

    if (changed.has('doc')) {
      this.loadFromScl();
      this.refreshUsedControlBlocks();

      if (this.showSwitchDiagram && this.switchLinks.length > 0) {
        this.buildSwitchDiagram(false);
      }
    }

    if (changed.has('activeTabIndex') && this.activeTabIndex === 1) {
      this.showSwitchDiagram = true;
      this.refreshSwitchLinks();
    }

    if (changed.has('vlanLabelFormat')) {
      this.rebuildDiagramForVlanLabelSizeChange();
    }

    if (changed.has('activeTabIndex') && this.activeTabIndex === 2) {
      this.refreshInputData();
      this.refreshSwitchLinks();
      if (this.doc) this.buildOutputConfiguration();
    }

    const configurationInputsChanged =
      changed.has('doc') ||
      changed.has('portData') ||
      changed.has('switchLinks') ||
      changed.has('nativeVlan') ||
      changed.has('switchVendor') ||
      changed.has('onlyConfigureIedPorts') ||
      changed.has('configureSingleIedConnectivity') ||
      changed.has('includePeerIedPortsForSingleIed') ||
      changed.has('includeUnsubscribedMessages') ||
      changed.has('selectedIedName') ||
      changed.has('selectedSwitchScope') ||
      changed.has('usedControlBlocks');

    if (this.activeTabIndex === 2 && configurationInputsChanged && this.doc) {
      this.buildOutputConfiguration();
    }

    if (
      (changed.has('showGooseTraffic') || changed.has('showSvTraffic')) &&
      this.showSwitchDiagram &&
      this.switchLinks.length > 0
    ) {
      this.invalidateComputedCaches();
      this.buildSwitchDiagram(false, true);
    }

    if (
      changed.has('switchDiagramSvg') ||
      changed.has('highlightedEdgeKeys') ||
      changed.has('highlightedShortestEdgeKeys') ||
      changed.has('highlightedNodes') ||
      changed.has('selectedPathStart') ||
      changed.has('selectedPathEnd') ||
      changed.has('selectedLinkEdgeKey')
    ) {
      this.decorateRenderedDiagram();
      this.applyPathHighlightingToDiagram();
    }
  }

  static getEdgeKey(source: string, target: string) {
    return [source, target].sort((a, b) => a.localeCompare(b)).join('::');
  }

  static parseEdgeTitle(
    title: string
  ): { source: string; target: string } | null {
    const match = title.match(/^\s*(.+?)\s*(--|->)\s*(.+?)\s*$/);
    if (!match) return null;

    return {
      source: match[1].trim(),
      target: match[3].trim()
    };
  }

  decorateRenderedDiagram() {
    const host = this.renderRoot.querySelector(
      '#switch-diagram-host'
    ) as HTMLElement | null;
    const svg = host?.querySelector('svg');
    if (!svg) return;

    Array.from(svg.querySelectorAll('g.node')).forEach(nodeGroup => {
      const title = nodeGroup.querySelector('title')?.textContent?.trim();
      if (!title) return;
      nodeGroup.setAttribute('data-node', title);
    });

    Array.from(svg.querySelectorAll('g.edge')).forEach(edgeGroup => {
      const title = edgeGroup.querySelector('title')?.textContent?.trim();
      if (!title) return;

      const parsed = NetworkConfig.parseEdgeTitle(title);
      if (!parsed) return;

      edgeGroup.setAttribute('data-source', parsed.source);
      edgeGroup.setAttribute('data-target', parsed.target);
      edgeGroup.setAttribute(
        'data-edge-key',
        NetworkConfig.getEdgeKey(parsed.source, parsed.target)
      );
    });
  }

  clearPathSelection() {
    this.selectedPathStart = '';
    this.selectedPathEnd = '';
    this.highlightedEdgeKeys = [];
    this.highlightedShortestEdgeKeys = [];
    this.highlightedNodes = [];
    this.pathTooltip = '';
    this.pathSelectionSummary = '';
    this.pathMetricsLabel = '';
  }

  private zoomDiagram(delta: number) {
    const nextZoom = Math.min(3, Math.max(0.4, this.diagramZoom + delta));
    this.diagramZoom = Math.round(nextZoom * 100) / 100;
  }

  private resetDiagramView() {
    this.diagramZoom = 1;
    this.diagramPanX = 0;
    this.diagramPanY = 0;
  }

  private zoomToFit() {
    const container = this.renderRoot.querySelector(
      '#switch-diagram-host'
    ) as HTMLElement | null;
    const viewport = container?.querySelector(
      '.diagram-viewport'
    ) as HTMLElement | null;
    if (!container || !viewport) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const contentWidth = viewport.offsetWidth;
    const contentHeight = viewport.offsetHeight;
    if (contentWidth === 0 || contentHeight === 0) return;

    const zoom = Math.min(
      containerWidth / contentWidth,
      containerHeight / contentHeight
    );
    // Allow zoom-to-fit to go much lower than the wheel-zoom minimum (0.4) so
    // that even very large diagrams are shown in full.
    const fitZoom = Math.round(Math.min(Math.max(zoom, 0.01), 3) * 100) / 100;
    this.diagramZoom = fitZoom;
    // Centre the content: split the remaining slack equally on each axis.
    this.diagramPanX = Math.round(
      (containerWidth - contentWidth * fitZoom) / 2
    );
    this.diagramPanY = Math.round(
      (containerHeight - contentHeight * fitZoom) / 2
    );
  }

  private onDiagramWheel(event: WheelEvent) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoomDiagram(direction);
  }

  private onDiagramPointerDown(event: PointerEvent) {
    if (event.button !== 0 && event.button !== 1) return;

    this.diagramActivePointerId = event.pointerId;
    this.isDiagramPanning = false;
    this.diagramPanMoved = false;
    this.diagramPanStartX = event.clientX;
    this.diagramPanStartY = event.clientY;
    this.diagramPanStartOffsetX = this.diagramPanX;
    this.diagramPanStartOffsetY = this.diagramPanY;
  }

  private onDiagramPointerMove(event: PointerEvent) {
    if (this.diagramActivePointerId !== event.pointerId) return;

    const buttons = event.buttons ?? 0;
    // eslint-disable-next-line no-bitwise
    const allowedButtons = 1 | 4;
    // eslint-disable-next-line no-bitwise
    if ((buttons & allowedButtons) === 0) return;

    const deltaX = event.clientX - this.diagramPanStartX;
    const deltaY = event.clientY - this.diagramPanStartY;

    if (!this.isDiagramPanning) {
      if (Math.abs(deltaX) + Math.abs(deltaY) <= 3) return;

      this.isDiagramPanning = true;
      this.diagramPanMoved = true;
      const host = event.currentTarget as HTMLElement | null;
      host?.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }

    this.diagramPanX = this.diagramPanStartOffsetX + deltaX;
    this.diagramPanY = this.diagramPanStartOffsetY + deltaY;
  }

  private onDiagramPointerUp(event: PointerEvent) {
    if (this.diagramActivePointerId !== event.pointerId) return;

    const wasPanning = this.isDiagramPanning;
    this.isDiagramPanning = false;
    this.diagramActivePointerId = null;

    if (this.diagramPanMoved) {
      this.suppressDiagramClick = true;
      this.diagramPanMoved = false;
      Promise.resolve().then(() => {
        this.suppressDiagramClick = false;
      });
    }
    if (wasPanning) {
      const host = event.currentTarget as HTMLElement | null;
      host?.releasePointerCapture?.(event.pointerId);
    }
  }

  private getNearestDiagramNodeName(args: {
    clientX: number;
    clientY: number;
    excludeNodeName?: string;
    maxDistancePx?: number;
  }): string {
    const { clientX, clientY, excludeNodeName = '', maxDistancePx = 72 } = args;

    const host = this.renderRoot.querySelector(
      '#switch-diagram-host'
    ) as HTMLElement | null;
    const svg = host?.querySelector('svg');
    if (!svg) return '';

    let nearestNodeName = '';
    let nearestDistance = Number.POSITIVE_INFINITY;

    Array.from(svg.querySelectorAll('g.node[data-node]')).forEach(nodeGroup => {
      const nodeName = nodeGroup.getAttribute('data-node') ?? '';
      if (nodeName === '' || nodeName === excludeNodeName) return;

      const bounds = (nodeGroup as SVGGraphicsElement).getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const distance = Math.hypot(centerX - clientX, centerY - clientY);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNodeName = nodeName;
      }
    });

    if (nearestDistance <= maxDistancePx) return nearestNodeName;
    return '';
  }

  private completePathSelection(endNodeName: string): void {
    if (endNodeName === '' || endNodeName === this.selectedPathStart) return;
    this.selectedPathEnd = endNodeName;
    this.applyPathHighlights(this.selectedPathStart, endNodeName);
  }

  onDiagramClick(event: Event) {
    const target = event.target as Element | null;
    const nodeElement = target?.closest('g.node[data-node]');
    const suppressedClick = this.suppressDiagramClick;
    if (suppressedClick) {
      this.suppressDiagramClick = false;
    }

    let nodeName = nodeElement?.getAttribute('data-node') ?? '';
    if (nodeName === '') {
      const mouseEvent = event as MouseEvent;
      if (
        Number.isFinite(mouseEvent.clientX) &&
        Number.isFinite(mouseEvent.clientY)
      ) {
        nodeName = this.getNearestDiagramNodeName({
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY
        });
      }
    }

    if (nodeName !== '') {
      this.clearSelectedLink();
      if (this.selectedPathStart === '' || this.selectedPathEnd !== '') {
        this.selectedPathStart = nodeName;
        this.selectedPathEnd = '';
        this.highlightedEdgeKeys = [];
        this.highlightedShortestEdgeKeys = [];
        this.highlightedNodes = [nodeName];
        this.pathSelectionSummary = `Start selected: ${nodeName}. Select another node to show paths.`;
        this.pathTooltip = this.pathSelectionSummary;
        return;
      }

      if (this.selectedPathStart === nodeName) {
        this.clearPathSelection();
        return;
      }

      this.completePathSelection(nodeName);
      return;
    }

    if (suppressedClick) return;

    const edgeElement = target?.closest('g.edge[data-edge-key]');
    if (edgeElement) {
      this.selectDiagramEdge(edgeElement);
    }
  }

  private applyPathHighlights(start: string, end: string) {
    const maxPaths = 10000;
    const result = calculateAndHighlightPaths({
      start,
      end,
      edges: this.diagramGraphEdges,
      maxPaths
    });

    if (result.allSimplePaths.length === 0) {
      this.highlightedEdgeKeys = [];
      this.highlightedShortestEdgeKeys = [];
      this.highlightedNodes = [start, end];
      this.pathSelectionSummary = `No path found between ${start} and ${end}.`;
      this.pathTooltip = this.pathSelectionSummary;
      this.pathMetricsLabel = '';
      return;
    }

    this.highlightedEdgeKeys = result.highlightedEdges;
    this.highlightedShortestEdgeKeys = result.highlightedShortestEdges;
    this.highlightedNodes = result.highlightedNodes;

    const allPathLines = result.allSimplePaths.map(
      (simplePath, index) =>
        `${index + 1}. ${this.formatDirectedPath(simplePath)}`
    );
    const shortestPathLines = result.shortestPaths.map(
      (shortestPath, index) =>
        `${index + 1}. ${this.formatDirectedPath(shortestPath)}`
    );

    const [firstShortestPath] = result.shortestPaths;
    const shortestLength = firstShortestPath ? firstShortestPath.length : 0;

    this.pathSelectionSummary = '';
    this.pathMetricsLabel = SHOW_PATH_DEBUG_METRICS
      ? `Paths: ${result.allSimplePaths.length} ${
          result.truncated ? '+' : ''
        } | Length: ${shortestLength} | Hops: ${Math.max(
          0,
          shortestLength - 1
        )}`
      : '';

    this.pathTooltip = [
      `Paths from ${start} to ${end}`,
      '',
      'All simple paths:',
      ...allPathLines,
      '',
      'Shortest paths:',
      ...shortestPathLines,
      result.truncated ? '' : '',
      result.truncated
        ? `Path listing truncated after ${maxPaths} paths to keep rendering responsive.`
        : ''
    ]
      .filter(line => line !== '')
      .join('\n');
  }

  formatDirectedPath(pathNodes: string[]) {
    if (pathNodes.length < 2) return pathNodes.join('');

    const segments: string[] = [pathNodes[0]];

    for (let i = 0; i < pathNodes.length - 1; i += 1) {
      const source = pathNodes[i];
      const target = pathNodes[i + 1];
      const label = this.edgeLabelByKey.get(
        NetworkConfig.getEdgeKey(source, target)
      );
      if (label && label !== '') {
        segments.push(` --(${label})--> ${target}`);
      } else {
        segments.push(` --> ${target}`);
      }
    }

    return segments.join('');
  }

  applyPathHighlightingToDiagram() {
    const host = this.renderRoot.querySelector(
      '#switch-diagram-host'
    ) as HTMLElement | null;
    const svg = host?.querySelector('svg');
    if (!svg) return;

    const activeEdgeKeys = new Set(this.highlightedEdgeKeys);
    const shortestEdgeKeys = new Set(this.highlightedShortestEdgeKeys);
    const activeNodes = new Set(this.highlightedNodes);
    const singleIedFocusHighlights = this.getSingleIedFocusHighlights();
    const singleIedEdgeHighlights = this.getSingleIedFocusEdgeHighlights();
    const linkSelectionIedHighlights = this.getLinkSelectionIedHighlights();
    const hasPathSelection =
      this.selectedPathStart !== '' && this.selectedPathEnd !== '';

    Array.from(svg.querySelectorAll('g.node[data-node]')).forEach(nodeGroup => {
      const nodeName = nodeGroup.getAttribute('data-node') ?? '';

      nodeGroup.classList.remove(
        'path-start',
        'path-end',
        'path-active',
        'path-muted',
        'ied-receiver-highlight',
        'ied-sender-highlight'
      );

      if (nodeName === this.selectedPathStart)
        nodeGroup.classList.add('path-start');
      if (nodeName === this.selectedPathEnd)
        nodeGroup.classList.add('path-end');
      if (activeNodes.has(nodeName)) nodeGroup.classList.add('path-active');
      if (
        singleIedFocusHighlights &&
        nodeName !== singleIedFocusHighlights.selectedIed
      ) {
        if (singleIedFocusHighlights.receiversFromSelected.has(nodeName)) {
          nodeGroup.classList.add('ied-receiver-highlight');
        }
        if (singleIedFocusHighlights.sendersToSelected.has(nodeName)) {
          nodeGroup.classList.add('ied-sender-highlight');
        }
      }
      if (linkSelectionIedHighlights) {
        if (linkSelectionIedHighlights.senderIeds.has(nodeName)) {
          nodeGroup.classList.add('ied-sender-highlight');
        }
        if (linkSelectionIedHighlights.receiverIeds.has(nodeName)) {
          nodeGroup.classList.add('ied-receiver-highlight');
        }
      }
      if (hasPathSelection && !activeNodes.has(nodeName)) {
        nodeGroup.classList.add('path-muted');
      }
    });

    Array.from(svg.querySelectorAll('g.edge[data-edge-key]')).forEach(
      edgeGroup => {
        const edgeKey = edgeGroup.getAttribute('data-edge-key') ?? '';

        edgeGroup.classList.remove(
          'path-active',
          'path-shortest',
          'path-muted',
          'link-selected',
          'ied-publisher-edge',
          'ied-subscriber-edge',
          'ied-both-edge'
        );

        if (activeEdgeKeys.has(edgeKey)) edgeGroup.classList.add('path-active');
        if (shortestEdgeKeys.has(edgeKey))
          edgeGroup.classList.add('path-shortest');
        if (edgeKey === this.selectedLinkEdgeKey)
          edgeGroup.classList.add('link-selected');
        if (
          hasPathSelection &&
          !activeEdgeKeys.has(edgeKey) &&
          edgeKey !== this.selectedLinkEdgeKey
        ) {
          edgeGroup.classList.add('path-muted');
        }

        if (singleIedEdgeHighlights) {
          const isPublisher =
            singleIedEdgeHighlights.publisherEdgeKeys.has(edgeKey);
          const isSubscriber =
            singleIedEdgeHighlights.subscriberEdgeKeys.has(edgeKey);
          if (isPublisher && isSubscriber) {
            edgeGroup.classList.add('ied-both-edge');
          } else if (isPublisher) {
            edgeGroup.classList.add('ied-publisher-edge');
          } else if (isSubscriber) {
            edgeGroup.classList.add('ied-subscriber-edge');
          }
        }
      }
    );
  }

  downloadSwitchDiagramSvg() {
    if (this.switchDiagramSvg === '') return;

    const blob = new Blob([this.switchDiagramSvg], {
      type: 'image/svg+xml;charset=utf-8'
    });

    const a = document.createElement('a');
    a.download = 'network-switch-diagram.svg';
    a.href = URL.createObjectURL(blob);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 5000);
  }

  downloadSwitchDiagramDot() {
    if (this.switchDiagramDot === '') return;

    const blob = new Blob([this.switchDiagramDot], {
      type: 'text/vnd.graphviz;charset=utf-8'
    });

    const a = document.createElement('a');
    a.download = 'network-switch-diagram.dot';
    a.href = URL.createObjectURL(blob);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 5000);
  }

  buildOutputConfiguration() {
    if (this.switchVendor === 'ruggedcom') {
      this.buildRuggedcomConfiguration();
    } else {
      this.buildCiscoConfiguration();
    }
  }

  private refreshUsedControlBlocks() {
    this.usedControlBlocks = getUsedCBs(this.doc);
  }

  buildRuggedcomConfiguration() {
    if (!this.portData) return;

    const iedPorts = new Set(getIedNames(this.doc));
    const publishedTrafficByIed = getPublishedTrafficByIed(this.doc);
    const subscribedTrafficByIed = getSubscribedTrafficByIed(
      this.usedControlBlocks
    );
    const iedTrafficIndex = buildIedTrafficIndex(
      this.doc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );

    this.outputUI.value = buildRuggedcomConfigurationText({
      portData: this.portData,
      switchLinks: this.switchLinks,
      iedPorts,
      iedTrafficIndex,
      publishedTrafficByIed,
      subscribedTrafficByIed,
      options: {
        allSwitchesOption: ALL_SWITCHES_OPTION,
        configureSingleIedConnectivity: this.configureSingleIedConnectivity,
        selectedIedName: this.selectedIedName,
        includePeerIedPortsForSingleIed: this.includePeerIedPortsForSingleIed,
        selectedSwitchScope: this.selectedSwitchScope,
        onlyConfigureIedPorts: this.onlyConfigureIedPorts,
        includeUnsubscribedMessages: this.includeUnsubscribedMessages,
        nativeVlan: this.nativeVlan
      }
    });
  }

  buildCiscoConfiguration() {
    if (!this.portData) return;

    const iedPorts = new Set(getIedNames(this.doc));
    const publishedTrafficByIed = getPublishedTrafficByIed(this.doc);
    const subscribedTrafficByIed = getSubscribedTrafficByIed(
      this.usedControlBlocks
    );
    const iedTrafficIndex = buildIedTrafficIndex(
      this.doc,
      publishedTrafficByIed,
      subscribedTrafficByIed
    );

    this.outputUI.value = buildCiscoConfigurationText({
      portData: this.portData,
      switchLinks: this.switchLinks,
      iedPorts,
      iedTrafficIndex,
      publishedTrafficByIed,
      subscribedTrafficByIed,
      options: {
        allSwitchesOption: ALL_SWITCHES_OPTION,
        configureSingleIedConnectivity: this.configureSingleIedConnectivity,
        selectedIedName: this.selectedIedName,
        includePeerIedPortsForSingleIed: this.includePeerIedPortsForSingleIed,
        selectedSwitchScope: this.selectedSwitchScope,
        onlyConfigureIedPorts: this.onlyConfigureIedPorts,
        includeUnsubscribedMessages: this.includeUnsubscribedMessages,
        nativeVlan: this.nativeVlan
      }
    });
  }

  protected firstUpdated(): void {
    this.refreshUsedControlBlocks();
    this.refreshInputData();
    this.refreshSwitchLinks();

    this.updateComplete.then(() => {
      if (this.iedSelectUI) {
        this.iedSelectUI.value = 'All IEDs';
      }
      if (this.ethernetSwitchUI) {
        this.ethernetSwitchUI.value = ALL_SWITCHES_OPTION;
      }
    });

    this.addEventListener('updated-input-data-file', () => {
      this.refreshInputData();
    });
  }

  // eslint-disable-next-line class-methods-use-this
  importData(): void {}

  private static readonly PRIVATE_NS =
    'https://openpowershift.com/Communication/network-config';

  private static readonly PRIVATE_NS_PREFIX = 'eopsnc';

  private static readonly PRIVATE_TYPE_IED =
    'OpenPowerShift-network-config-ied-data';

  private static readonly PRIVATE_TYPE_SWITCH =
    'OpenPowerShift-network-config-switch-links';

  /** Load IED and switch-link data saved as Private elements in the SCL doc. */
  private loadFromScl(): void {
    if (!this.doc?.documentElement) return;
    const OPS_NS_NC = NetworkConfig.PRIVATE_NS;

    const iedPrivate = this.doc.querySelector(
      `:root > Communication > Private[type="${NetworkConfig.PRIVATE_TYPE_IED}"]`
    );

    const iedData = iedPrivate?.getElementsByTagNameNS(
      OPS_NS_NC,
      'Network-Config-IED-Data'
    )[0];
    if (iedData?.textContent?.trim()) {
      this.inputCsvData = iedData.textContent.trim();
      this.refreshInputData();
    }

    const switchPrivate = this.doc.querySelector(
      `:root > Communication > Private[type="${NetworkConfig.PRIVATE_TYPE_SWITCH}"]`
    );
    const switchLinks = switchPrivate?.getElementsByTagNameNS(
      OPS_NS_NC,
      'Network-Config-Switch-Links'
    )[0];
    if (switchLinks?.textContent?.trim()) {
      this.switchLinksInput = switchLinks.textContent.trim();
      this.refreshSwitchLinks();
    }
  }

  /** Save IED and switch-link CSV data as Private elements in the SCL doc. */
  saveToScl(): void {
    if (!this.doc?.documentElement) {
      this.showSnackbar('No SCL document loaded.');
      return;
    }

    const ns = NetworkConfig.PRIVATE_NS;
    const prefix = NetworkConfig.PRIVATE_NS_PREFIX;
    const edits: EditV2[] = [];

    // Declare the OpenPowerShift namespace on the root SCL element so it does
    // not appear redundantly on individual child elements.
    edits.push({
      element: this.doc.documentElement,
      attributesNS: {
        'http://www.w3.org/2000/xmlns/': { [`xmlns:${prefix}`]: ns }
      }
    });

    const comm = this.doc.querySelector(':root > Communication');
    if (!comm) return;

    const existingPrivates = Array.from(
      comm.querySelectorAll<Element>(
        `:scope > Private[type="${NetworkConfig.PRIVATE_TYPE_IED}"],` +
          `:scope > Private[type="${NetworkConfig.PRIVATE_TYPE_SWITCH}"]`
      )
    );
    existingPrivates.forEach(el => edits.push({ node: el }));

    const reference: Element | null =
      existingPrivates.length > 0
        ? existingPrivates[existingPrivates.length - 1].nextElementSibling
        : getReference(comm, 'Private');

    const iedPrivate = this.doc.createElementNS(
      this.doc.documentElement.namespaceURI,
      'Private'
    );
    iedPrivate.setAttribute('type', NetworkConfig.PRIVATE_TYPE_IED);
    const iedEl = this.doc.createElementNS(
      ns,
      `${prefix}:Network-Config-IED-Data`
    );
    iedEl.textContent = this.inputCsvData;
    iedPrivate.appendChild(iedEl);
    edits.push({ parent: comm, node: iedPrivate, reference });

    const switchPrivate = this.doc.createElementNS(
      this.doc.documentElement.namespaceURI,
      'Private'
    );
    switchPrivate.setAttribute('type', NetworkConfig.PRIVATE_TYPE_SWITCH);
    const switchEl = this.doc.createElementNS(
      ns,
      `${prefix}:Network-Config-Switch-Links`
    );
    switchEl.textContent = this.switchLinksInput;
    switchPrivate.appendChild(switchEl);
    edits.push({ parent: comm, node: switchPrivate, reference });

    this.dispatchEvent(
      newEditEventV2(edits, { title: 'Save network configuration to SCL' })
    );
    this.showSnackbar('Network configuration saved to SCL.');
  }

  private getAvailableSwitches(): string[] {
    if (
      !this.configureSingleIedConnectivity ||
      this.selectedIedName === '' ||
      this.selectedIedName === 'All IEDs'
    ) {
      return this.switchNames;
    }

    const selectedIedSwitches = (this.portData ?? [])
      .filter(port => port.iedName === this.selectedIedName)
      .map(port => port.switchName?.trim() ?? '')
      .filter(name => name !== '');

    return [...new Set(selectedIedSwitches)].sort((a, b) => a.localeCompare(b));
  }

  private getActiveScopeSummary(): string {
    const switchScope =
      this.selectedSwitchScope === ALL_SWITCHES_OPTION ||
      this.selectedSwitchScope === ''
        ? 'All switches'
        : `Switch ${this.selectedSwitchScope}`;

    let iedScope = 'All IEDs in input CSV';
    if (this.configureSingleIedConnectivity) {
      if (this.selectedIedName !== '') {
        const peerSuffix = this.includePeerIedPortsForSingleIed
          ? ' + communicating peers'
          : '';
        iedScope = `Single IED ${this.selectedIedName}${peerSuffix}`;
      } else {
        iedScope = 'Single IED (not selected)';
      }
    }

    const portScope = this.onlyConfigureIedPorts
      ? 'IED ports only'
      : 'IED + inter-switch ports';

    return `Active scope: ${switchScope} | ${iedScope} | ${portScope}`;
  }

  private static getServiceTypeForControlBlock(
    controlBlock: Element
  ): 'GOOSE' | 'SV' | null {
    if (controlBlock.tagName === 'GSEControl') return 'GOOSE';
    if (controlBlock.tagName === 'SampledValueControl') return 'SV';
    return null;
  }

  private getIedToSwitchIndex(): Map<string, string> {
    if (this._iedToSwitchCache) return this._iedToSwitchCache;
    const iedToSwitch = new Map<string, string>();
    (this.portData ?? []).forEach(port => {
      const switchName = port.switchName?.trim() ?? '';
      const iedName = port.iedName?.trim() ?? '';
      if (switchName !== '' && iedName !== '')
        iedToSwitch.set(iedName, switchName);
    });
    this._iedToSwitchCache = iedToSwitch;
    return iedToSwitch;
  }

  private getSwitchAdjacency(): Map<string, Set<string>> {
    if (this._switchAdjacencyCache) return this._switchAdjacencyCache;
    const adjacency = new Map<string, Set<string>>();
    this.switchLinks.forEach(link => {
      const source = link.sourceSwitch?.trim() ?? '';
      const target = link.targetSwitch?.trim() ?? '';
      if (source === '' || target === '') return;
      if (!adjacency.has(source)) adjacency.set(source, new Set<string>());
      if (!adjacency.has(target)) adjacency.set(target, new Set<string>());
      adjacency.get(source)!.add(target);
      adjacency.get(target)!.add(source);
    });
    this._switchAdjacencyCache = adjacency;
    return adjacency;
  }

  private findSwitchPath(start: string, end: string): string[] {
    if (start === '' || end === '') return [];
    if (start === end) return [start];

    const cacheKey = `${start}::${end}`;
    if (this._switchPathCache.has(cacheKey))
      return this._switchPathCache.get(cacheKey)!;

    const adjacency = this.getSwitchAdjacency();
    const queue: string[] = [start];
    const visited = new Set<string>([start]);
    const parent = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (current === end) {
        // push+reverse is O(n); repeated unshift would be O(n²).
        const path: string[] = [];
        let node: string | undefined = end;
        while (node !== undefined) {
          path.push(node);
          node = parent.get(node);
        }
        path.reverse();
        this._switchPathCache.set(cacheKey, path);
        return path;
      }

      const neighbors = adjacency.get(current) ?? new Set<string>();
      neighbors.forEach(neighbor => {
        if (visited.has(neighbor)) return;
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      });
    }

    this._switchPathCache.set(cacheKey, []);
    return [];
  }

  private buildConnectedApAddressIndex(): Map<
    string,
    { mac: string; vlan: number }
  > {
    const index = new Map<string, { mac: string; vlan: number }>();
    if (!this.doc?.documentElement) return index;

    // Single DOM traversal to index all GSE/SMV addresses.
    // Key: "iedName||cbName||serviceType" for O(1) lookup per control block.
    this.doc
      .querySelectorAll(':root > Communication > SubNetwork > ConnectedAP')
      .forEach(ap => {
        const iedName = ap.getAttribute('iedName')?.trim() ?? '';
        if (!iedName) return;

        ap.querySelectorAll(':scope > GSE, :scope > SMV').forEach(address => {
          const cbName = address.getAttribute('cbName')?.trim() ?? '';
          if (!cbName) return;

          let mac = '';
          let vlanText = '0';
          address.querySelectorAll('Address > P').forEach(p => {
            const pType = p.getAttribute('type');
            if (pType === 'MAC-Address') mac = p.textContent?.trim() ?? '';
            else if (pType === 'VLAN-ID') vlanText = p.textContent ?? '0';
          });

          const vlan = Number.parseInt(vlanText, 16);
          const serviceType: 'GOOSE' | 'SV' =
            address.tagName === 'SMV' ? 'SV' : 'GOOSE';
          index.set(`${iedName}||${cbName}||${serviceType}`, {
            mac,
            vlan: Number.isNaN(vlan) ? 0 : vlan
          });
        });
      });

    return index;
  }

  private getControlBlockAddress(controlBlock: Element): {
    mac: string;
    vlan: number;
  } {
    if (this._controlBlockAddressCache.has(controlBlock))
      return this._controlBlockAddressCache.get(controlBlock)!;

    if (!this.doc?.documentElement) return { mac: '', vlan: 0 };

    const iedName =
      controlBlock.closest('IED')?.getAttribute('name')?.trim() ?? '';
    const controlBlockName = controlBlock.getAttribute('name')?.trim() ?? '';
    const serviceType =
      NetworkConfig.getServiceTypeForControlBlock(controlBlock);

    if (iedName === '' || controlBlockName === '' || !serviceType) {
      return { mac: '', vlan: 0 };
    }

    // Build the index on first use — one DOM scan instead of one per call.
    if (!this._connectedApAddressIndex) {
      this._connectedApAddressIndex = this.buildConnectedApAddressIndex();
    }

    const result = this._connectedApAddressIndex.get(
      `${iedName}||${controlBlockName}||${serviceType}`
    ) ?? { mac: '', vlan: 0 };

    this._controlBlockAddressCache.set(controlBlock, result);
    return result;
  }

  private getFlowEdgeKeys(args: {
    senderIed: string;
    receiverIed: string;
    senderSwitch: string;
    receiverSwitch: string;
  }): Set<string> {
    const { senderIed, receiverIed, senderSwitch, receiverSwitch } = args;
    const edgeKeys = new Set<string>();

    if (senderSwitch !== '' && senderIed !== '') {
      edgeKeys.add(NetworkConfig.getEdgeKey(senderSwitch, senderIed));
    }

    if (
      receiverSwitch !== '' &&
      receiverIed !== '' &&
      receiverIed !== 'Unsubscribed'
    ) {
      edgeKeys.add(NetworkConfig.getEdgeKey(receiverSwitch, receiverIed));
    }

    // Skip inter-switch path finding when both endpoints are on the same switch.
    if (senderSwitch !== '' && senderSwitch !== receiverSwitch) {
      const path = this.findSwitchPath(senderSwitch, receiverSwitch);
      for (let i = 0; i < path.length - 1; i += 1) {
        edgeKeys.add(NetworkConfig.getEdgeKey(path[i], path[i + 1]));
      }
    }

    return edgeKeys;
  }

  private getSwitchNameIndex(): Set<string> {
    if (this._switchNameIndexCache !== null) return this._switchNameIndexCache;

    const switchNames = new Set<string>();
    this.switchLinks.forEach(link => {
      const source = link.sourceSwitch?.trim() ?? '';
      const target = link.targetSwitch?.trim() ?? '';
      if (source !== '') switchNames.add(source);
      if (target !== '') switchNames.add(target);
    });
    (this.portData ?? []).forEach(port => {
      const switchName = port.switchName?.trim() ?? '';
      if (switchName !== '') switchNames.add(switchName);
    });

    this._switchNameIndexCache = switchNames;
    return switchNames;
  }

  private buildLinkTrafficCandidates(): LinkTrafficCandidate[] {
    if (this._linkTrafficCandidatesCache !== null)
      return this._linkTrafficCandidatesCache;

    if (!this.doc?.documentElement || !this.portData) return [];

    const iedToSwitch = this.getIedToSwitchIndex();
    const candidates: LinkTrafficCandidate[] = [];
    const dedupe = new Set<string>();
    const usedControlBlocks =
      this.usedControlBlocks ?? new Map<Element, string[]>();

    usedControlBlocks.forEach((subscriberIeds, controlBlock) => {
      const serviceType =
        NetworkConfig.getServiceTypeForControlBlock(controlBlock);
      if (!serviceType) return;

      const senderIed =
        controlBlock.closest('IED')?.getAttribute('name')?.trim() ?? '';
      const controlBlockName = controlBlock.getAttribute('name')?.trim() ?? '';
      if (senderIed === '' || controlBlockName === '') return;

      const senderSwitch = iedToSwitch.get(senderIed) ?? '';
      if (senderSwitch === '') return;

      const { mac, vlan } = this.getControlBlockAddress(controlBlock);

      subscriberIeds.forEach(receiverIed => {
        const receiverSwitch = iedToSwitch.get(receiverIed) ?? '';
        const edgeKeys = this.getFlowEdgeKeys({
          senderIed,
          receiverIed,
          senderSwitch,
          receiverSwitch
        });

        const key = [
          senderIed,
          receiverIed,
          serviceType,
          controlBlockName
        ].join('::');
        if (dedupe.has(key)) return;
        dedupe.add(key);

        candidates.push({
          entry: {
            senderIed,
            receiverIed,
            serviceType,
            controlBlockName,
            vlan,
            mac,
            senderSwitch,
            receiverSwitch
          },
          edgeKeys,
          senderSwitch,
          receiverSwitch
        });
      });
    });

    if (this.includeUnsubscribedMessages) {
      const usedControlBlockSet = new Set(Array.from(usedControlBlocks.keys()));
      const allControlBlocks = Array.from(
        this.doc.querySelectorAll(
          ':root > IED GSEControl, :root > IED SampledValueControl'
        )
      ).filter(controlBlock => !controlBlock.closest('Private'));

      allControlBlocks.forEach(controlBlock => {
        if (usedControlBlockSet.has(controlBlock)) return;

        const serviceType =
          NetworkConfig.getServiceTypeForControlBlock(controlBlock);
        if (!serviceType) return;

        const senderIed =
          controlBlock.closest('IED')?.getAttribute('name')?.trim() ?? '';
        const controlBlockName =
          controlBlock.getAttribute('name')?.trim() ?? '';
        if (senderIed === '' || controlBlockName === '') return;

        const senderSwitch = iedToSwitch.get(senderIed) ?? '';
        if (senderSwitch === '') return;

        const edgeKeys = this.getFlowEdgeKeys({
          senderIed,
          receiverIed: 'Unsubscribed',
          senderSwitch,
          receiverSwitch: ''
        });

        const key = [
          senderIed,
          'Unsubscribed',
          serviceType,
          controlBlockName
        ].join('::');
        if (dedupe.has(key)) return;
        dedupe.add(key);

        const { mac, vlan } = this.getControlBlockAddress(controlBlock);
        candidates.push({
          entry: {
            senderIed,
            receiverIed: 'Unsubscribed',
            serviceType,
            controlBlockName,
            vlan,
            mac,
            senderSwitch,
            receiverSwitch: ''
          },
          edgeKeys,
          senderSwitch,
          receiverSwitch: ''
        });
      });
    }

    this._linkTrafficCandidatesCache = candidates;
    return candidates;
  }

  private buildSelectedLinkTrafficEntries(): LinkTrafficEntry[] {
    const candidates = this.buildLinkTrafficCandidates();
    if (candidates.length === 0) return [];

    let filteredCandidates = candidates;
    const iedToSwitch = this.getIedToSwitchIndex();

    if (this.selectedLinkEdgeKey !== '') {
      filteredCandidates = filteredCandidates.filter(candidate =>
        candidate.edgeKeys.has(this.selectedLinkEdgeKey)
      );
    } else if (this.selectedPathStart !== '' && this.selectedPathEnd !== '') {
      const switchNames = this.getSwitchNameIndex();
      const highlightedEdgeSet = new Set(this.highlightedEdgeKeys);
      const startNode = this.selectedPathStart;
      const endNode = this.selectedPathEnd;
      const startIsIed = iedToSwitch.has(startNode);
      const endIsIed = iedToSwitch.has(endNode);
      const startIsSwitch = switchNames.has(startNode);
      const endIsSwitch = switchNames.has(endNode);

      const candidateTouchesHighlightedPath = (
        candidate: LinkTrafficCandidate
      ) =>
        highlightedEdgeSet.size === 0
          ? true
          : Array.from(candidate.edgeKeys).some(edgeKey =>
              highlightedEdgeSet.has(edgeKey)
            );

      if (startIsIed && endIsIed) {
        const selectedSubscribers = new Set([startNode, endNode]);
        filteredCandidates = filteredCandidates.filter(candidate =>
          selectedSubscribers.has(candidate.entry.receiverIed)
        );
      } else if (startIsSwitch && endIsSwitch) {
        filteredCandidates = filteredCandidates.filter(candidate =>
          candidateTouchesHighlightedPath(candidate)
        );
      } else if ((startIsIed && endIsSwitch) || (startIsSwitch && endIsIed)) {
        const selectedIed = startIsIed ? startNode : endNode;
        const selectedSwitch = startIsSwitch ? startNode : endNode;

        filteredCandidates = filteredCandidates.filter(candidate => {
          const involvesIed =
            candidate.entry.senderIed === selectedIed ||
            candidate.entry.receiverIed === selectedIed;
          if (!involvesIed) return false;

          const touchesPath = candidateTouchesHighlightedPath(candidate);
          if (touchesPath) return true;

          return (
            candidate.senderSwitch === selectedSwitch ||
            candidate.receiverSwitch === selectedSwitch
          );
        });
      }
    } else if (this.selectedPathStart !== '' && this.selectedPathEnd === '') {
      const selectedNode = this.selectedPathStart;
      if (iedToSwitch.has(selectedNode)) {
        filteredCandidates = filteredCandidates.filter(
          candidate => candidate.entry.senderIed === selectedNode
        );
      } else {
        return [];
      }
    } else {
      return [];
    }

    const entries = this.filterEntriesBySelectedServices(
      filteredCandidates.map(candidate => candidate.entry)
    );

    return entries.sort((first, second) => {
      const firstKey = `${first.senderIed}|${first.receiverIed}|${first.serviceType}|${first.controlBlockName}`;
      const secondKey = `${second.senderIed}|${second.receiverIed}|${second.serviceType}|${second.controlBlockName}`;
      return firstKey.localeCompare(secondKey);
    });
  }

  private isServiceTypeVisible(serviceType: 'GOOSE' | 'SV'): boolean {
    if (serviceType === 'GOOSE') return this.showGooseTraffic;
    return this.showSvTraffic;
  }

  private filterEntriesBySelectedServices(
    entries: LinkTrafficEntry[]
  ): LinkTrafficEntry[] {
    if (this.showGooseTraffic && this.showSvTraffic) return entries;
    return entries.filter(entry =>
      this.isServiceTypeVisible(entry.serviceType)
    );
  }

  private getSingleIedFocusHighlights(): {
    selectedIed: string;
    receiversFromSelected: Set<string>;
    sendersToSelected: Set<string>;
  } | null {
    if (this.selectedPathStart === '' || this.selectedPathEnd !== '')
      return null;

    const iedToSwitch = this.getIedToSwitchIndex();
    const selectedIed = this.selectedPathStart;
    if (!iedToSwitch.has(selectedIed)) return null;

    const receiversFromSelected = new Set<string>();
    const sendersToSelected = new Set<string>();
    const entries = this.filterEntriesBySelectedServices(
      this.buildLinkTrafficCandidates().map(candidate => candidate.entry)
    );

    entries.forEach(entry => {
      const { senderIed, receiverIed } = entry;

      if (
        senderIed === selectedIed &&
        receiverIed !== selectedIed &&
        receiverIed !== 'Unsubscribed'
      ) {
        receiversFromSelected.add(receiverIed);
      }

      if (receiverIed === selectedIed && senderIed !== selectedIed) {
        sendersToSelected.add(senderIed);
      }
    });

    return {
      selectedIed,
      receiversFromSelected,
      sendersToSelected
    };
  }

  private getLinkSelectionIedHighlights(): {
    senderIeds: Set<string>;
    receiverIeds: Set<string>;
  } | null {
    if (this.selectedLinkEdgeKey === '') return null;

    const candidates = this.buildLinkTrafficCandidates().filter(c =>
      c.edgeKeys.has(this.selectedLinkEdgeKey)
    );
    const entries = this.filterEntriesBySelectedServices(
      candidates.map(c => c.entry)
    );

    const senderIeds = new Set<string>();
    const receiverIeds = new Set<string>();
    entries.forEach(entry => {
      senderIeds.add(entry.senderIed);
      if (entry.receiverIed !== 'Unsubscribed') {
        receiverIeds.add(entry.receiverIed);
      }
    });

    return { senderIeds, receiverIeds };
  }

  private getSingleIedFocusEdgeHighlights(): {
    publisherEdgeKeys: Set<string>;
    subscriberEdgeKeys: Set<string>;
  } | null {
    if (this.selectedPathStart === '' || this.selectedPathEnd !== '')
      return null;
    const iedToSwitch = this.getIedToSwitchIndex();
    const selectedIed = this.selectedPathStart;
    if (!iedToSwitch.has(selectedIed)) return null;

    const publisherEdgeKeys = new Set<string>();
    const subscriberEdgeKeys = new Set<string>();

    this.buildLinkTrafficCandidates().forEach(candidate => {
      if (!this.isServiceTypeVisible(candidate.entry.serviceType)) return;
      const { senderIed, receiverIed } = candidate.entry;

      if (senderIed === selectedIed && receiverIed !== 'Unsubscribed') {
        candidate.edgeKeys.forEach(k => publisherEdgeKeys.add(k));
      }
      if (receiverIed === selectedIed) {
        candidate.edgeKeys.forEach(k => subscriberEdgeKeys.add(k));
      }
    });

    return { publisherEdgeKeys, subscriberEdgeKeys };
  }

  private buildSingleIedSubscribedTrafficEntries(): LinkTrafficEntry[] {
    if (this.selectedPathStart === '' || this.selectedPathEnd !== '') return [];
    const iedToSwitch = this.getIedToSwitchIndex();
    if (!iedToSwitch.has(this.selectedPathStart)) return [];

    const selectedNode = this.selectedPathStart;
    const candidates = this.buildLinkTrafficCandidates();

    const entries = this.filterEntriesBySelectedServices(
      candidates
        .filter(candidate => candidate.entry.receiverIed === selectedNode)
        .map(candidate => candidate.entry)
    );

    return entries.sort((first, second) => {
      const firstKey = `${first.senderIed}|${first.receiverIed}|${first.serviceType}|${first.controlBlockName}`;
      const secondKey = `${second.senderIed}|${second.receiverIed}|${second.serviceType}|${second.controlBlockName}`;
      return firstKey.localeCompare(secondKey);
    });
  }

  private static groupLinkTrafficEntries(
    entries: LinkTrafficEntry[]
  ): LinkTrafficGroup[] {
    const groupsByPair = new Map<string, LinkTrafficGroup>();

    entries.forEach(entry => {
      const pairKey = `${entry.senderIed}::${entry.receiverIed}`;
      if (!groupsByPair.has(pairKey)) {
        groupsByPair.set(pairKey, {
          senderIed: entry.senderIed,
          receiverIed: entry.receiverIed,
          gooseEntries: [],
          svEntries: []
        });
      }

      const group = groupsByPair.get(pairKey)!;
      if (entry.serviceType === 'GOOSE') group.gooseEntries.push(entry);
      if (entry.serviceType === 'SV') group.svEntries.push(entry);
    });

    return Array.from(groupsByPair.values()).sort((first, second) => {
      const firstKey = `${first.senderIed}|${first.receiverIed}`;
      const secondKey = `${second.senderIed}|${second.receiverIed}`;
      return firstKey.localeCompare(secondKey);
    });
  }

  private formatVlanForDisplay(vlan: number): string {
    if (!Number.isFinite(vlan) || vlan === 0) return 'N/A';
    if (this.vlanLabelFormat === 'hex') {
      return `0x${vlan.toString(16).toUpperCase().padStart(3, '0')}`;
    }
    return `${vlan}`;
  }

  private clearSelectedLink(): void {
    this.selectedLinkEdgeKey = '';
    this.selectedLinkSource = '';
    this.selectedLinkTarget = '';
  }

  private selectDiagramEdge(edgeElement: Element): void {
    const edgeKey = edgeElement.getAttribute('data-edge-key') ?? '';
    if (edgeKey === '') return;

    if (this.selectedLinkEdgeKey === edgeKey) {
      this.clearSelectedLink();
      return;
    }

    this.clearPathSelection();
    this.selectedLinkEdgeKey = edgeKey;
    this.selectedLinkSource = edgeElement.getAttribute('data-source') ?? '';
    this.selectedLinkTarget = edgeElement.getAttribute('data-target') ?? '';
  }

  private renderSelectionChips(
    hasPathSelection: boolean,
    hasSingleIedSelection: boolean,
    selectionLabel: string
  ): TemplateResult {
    if (hasPathSelection) {
      return html`<span class="ied-chip ied-chip--selected"
          >${this.selectedPathStart}</span
        >
        <span class="ied-arrow">↔</span>
        <span class="ied-chip ied-chip--end">${this.selectedPathEnd}</span>`;
    }
    if (hasSingleIedSelection) {
      return html`<span class="ied-chip ied-chip--selected"
        >${this.selectedPathStart}</span
      >`;
    }
    return html`${selectionLabel}`;
  }

  private renderLinkDetailsPane(): TemplateResult {
    const hasPathStart = this.selectedPathStart !== '';
    const hasPathSelection =
      this.selectedPathStart !== '' && this.selectedPathEnd !== '';
    const iedToSwitch = this.getIedToSwitchIndex();
    const hasSingleIedSelection =
      hasPathStart &&
      !hasPathSelection &&
      iedToSwitch.has(this.selectedPathStart);
    const showPane =
      this.linkDetailsPinned || this.selectedLinkEdgeKey !== '' || hasPathStart;
    if (!showPane) return html``;

    const entries = this.buildSelectedLinkTrafficEntries();
    const groups = NetworkConfig.groupLinkTrafficEntries(entries);
    const switchNames = this.getSwitchNameIndex();
    const selectedPathNodes =
      hasPathSelection &&
      switchNames.has(this.selectedPathStart) &&
      switchNames.has(this.selectedPathEnd)
        ? this.findSwitchPath(this.selectedPathStart, this.selectedPathEnd)
        : [];
    let selectionLabel = '';
    if (this.selectedLinkEdgeKey !== '') {
      selectionLabel =
        this.selectedLinkSource !== '' && this.selectedLinkTarget !== ''
          ? `${this.selectedLinkSource} ↔ ${this.selectedLinkTarget}`
          : this.selectedLinkEdgeKey;
    } else if (hasPathSelection) {
      selectionLabel = `${this.selectedPathStart} ↔ ${this.selectedPathEnd}`;
    } else if (hasPathStart) {
      selectionLabel = `Start: ${this.selectedPathStart}`;
    }
    const pathLabel =
      selectedPathNodes.length > 1 ? selectedPathNodes.join(' - ') : '';

    const renderTrafficTable = (
      serviceLabel: 'GOOSE' | 'SV',
      serviceEntries: LinkTrafficEntry[]
    ) =>
      html`<div class="link-service-block">
        <h5>${serviceLabel}</h5>
        <table
          class="link-traffic-table"
          aria-label="${serviceLabel} traffic details"
        >
          <thead>
            <tr>
              <th>Control Block</th>
              <th>VLAN</th>
              <th>MAC</th>
            </tr>
          </thead>
          <tbody>
            ${serviceEntries.map(
              entry =>
                html`<tr>
                  <td>${entry.controlBlockName}</td>
                  <td class="vlan-cell">
                    ${this.formatVlanForDisplay(entry.vlan)}
                  </td>
                  <td class="mac-cell">
                    ${entry.mac !== '' ? entry.mac : 'N/A'}
                  </td>
                </tr>`
            )}
          </tbody>
        </table>
      </div>`;

    type IedRole = 'selected' | 'end' | 'receiver' | 'sender' | null;

    const iedChip = (name: string, role: IedRole) => {
      if (!role) return html`${name}`;
      return html`<span class="ied-chip ied-chip--${role}">${name}</span>`;
    };

    const renderGroupedTraffic = (
      trafficGroups: LinkTrafficGroup[],
      senderRole: IedRole = null,
      receiverRole: IedRole = null
    ) =>
      html`${trafficGroups.map(
        group =>
          html`<section class="link-traffic-group">
            <h4>
              ${iedChip(group.senderIed, senderRole)}
              <span class="ied-arrow">→</span>
              ${iedChip(group.receiverIed, receiverRole)}
            </h4>
            ${group.gooseEntries.length > 0
              ? renderTrafficTable('GOOSE', group.gooseEntries)
              : html``}
            ${group.svEntries.length > 0
              ? renderTrafficTable('SV', group.svEntries)
              : html``}
          </section>`
      )}`;

    const getDirectionBucket = (
      entry: LinkTrafficEntry,
      startSwitch: string,
      endSwitch: string,
      pathNodes: string[]
    ): 'start' | 'end' => {
      if (entry.senderSwitch === startSwitch) return 'start';
      if (entry.senderSwitch === endSwitch) return 'end';

      const senderIndex = pathNodes.indexOf(entry.senderSwitch);
      if (senderIndex >= 0) {
        const distanceToStart = senderIndex;
        const distanceToEnd = pathNodes.length - 1 - senderIndex;
        return distanceToStart <= distanceToEnd ? 'start' : 'end';
      }

      if (entry.receiverSwitch === startSwitch) return 'end';
      if (entry.receiverSwitch === endSwitch) return 'start';

      const receiverIndex = pathNodes.indexOf(entry.receiverSwitch);
      if (receiverIndex >= 0) {
        const distanceToStart = receiverIndex;
        const distanceToEnd = pathNodes.length - 1 - receiverIndex;
        return distanceToStart <= distanceToEnd ? 'end' : 'start';
      }

      return 'start';
    };

    const directionalTemplate =
      selectedPathNodes.length > 1
        ? (() => {
            const [startSwitch] = selectedPathNodes;
            const endSwitch = selectedPathNodes[selectedPathNodes.length - 1];
            const fromStartEntries: LinkTrafficEntry[] = [];
            const fromEndEntries: LinkTrafficEntry[] = [];

            entries.forEach(entry => {
              const bucket = getDirectionBucket(
                entry,
                startSwitch,
                endSwitch,
                selectedPathNodes
              );
              if (bucket === 'start') fromStartEntries.push(entry);
              else fromEndEntries.push(entry);
            });

            const fromStartGroups =
              NetworkConfig.groupLinkTrafficEntries(fromStartEntries);
            const fromEndGroups =
              NetworkConfig.groupLinkTrafficEntries(fromEndEntries);

            return html`
              <section class="traffic-direction-section">
                <h4 class="traffic-direction-title">
                  <span class="title-dot title-dot--selected"></span>
                  From ${startSwitch}
                </h4>
                ${fromStartGroups.length === 0
                  ? html`<p class="diagram-note">
                      No matching traffic in this direction. Are the GOOSE/SV
                      checkboxes correct?
                    </p>`
                  : renderGroupedTraffic(fromStartGroups)}
              </section>
              <section class="traffic-direction-section">
                <h4 class="traffic-direction-title">
                  <span class="title-dot title-dot--end"></span>
                  From ${endSwitch}
                </h4>
                ${fromEndGroups.length === 0
                  ? html`<p class="diagram-note">
                      No matching traffic in this direction.
                    </p>`
                  : renderGroupedTraffic(fromEndGroups)}
              </section>
            `;
          })()
        : renderGroupedTraffic(groups);
    let bodyTemplate: TemplateResult = html`${directionalTemplate}`;
    if (selectionLabel === '') {
      bodyTemplate = html`<p class="diagram-note">
        No link or path selected.
      </p>`;
    } else if (hasPathStart && !hasPathSelection && !hasSingleIedSelection) {
      bodyTemplate = html`<p class="diagram-note">
        Select another node to show path traffic.
      </p>`;
    } else if (hasSingleIedSelection) {
      const subscribedEntries = this.buildSingleIedSubscribedTrafficEntries();
      const subscribedGroups =
        NetworkConfig.groupLinkTrafficEntries(subscribedEntries);
      bodyTemplate = html`
        <section class="traffic-direction-section">
          <h4 class="traffic-direction-title">
            <span class="title-dot title-dot--selected"></span>
            Published
          </h4>
          ${groups.length === 0
            ? html`<p class="diagram-note">No published traffic found.</p>`
            : renderGroupedTraffic(groups, 'selected', 'receiver')}
        </section>
        <section class="traffic-direction-section">
          <h4 class="traffic-direction-title">
            <span class="title-dot title-dot--sender"></span>
            Subscribed
          </h4>
          ${subscribedGroups.length === 0
            ? html`<p class="diagram-note">No subscribed traffic found.</p>`
            : renderGroupedTraffic(subscribedGroups, 'sender', 'selected')}
        </section>
      `;
    } else if (groups.length === 0) {
      bodyTemplate = html`<p class="diagram-note">
        No matching GOOSE/SV traffic found for this selection.
      </p>`;
    }

    const allVlans = [
      ...new Set(entries.map(e => e.vlan).filter(v => v !== 0))
    ].sort((a, b) => a - b);
    const vlanSummary =
      allVlans.length > 0
        ? allVlans.map(v => this.formatVlanForDisplay(v)).join(', ')
        : '';

    return html`<aside
      class="link-details-pane"
      aria-label="Path traffic details"
    >
      <div class="link-details-header">
        <h3>Path Traffic</h3>
      </div>
      <div class="link-details-body">
        ${selectionLabel !== ''
          ? html`<p class="link-details-selection">
              ${this.renderSelectionChips(
                hasPathSelection,
                hasSingleIedSelection,
                selectionLabel
              )}
            </p>`
          : html``}
        ${vlanSummary !== ''
          ? html`<p class="link-details-vlans">VLANs: ${vlanSummary}</p>`
          : html``}
        ${pathLabel !== ''
          ? html`<p class="link-details-path">Path: ${pathLabel}</p>`
          : html``}
        ${bodyTemplate}
      </div>
      <div class="link-details-footer">
        <md-outlined-button
          class="link-pin-button"
          @click=${() => {
            this.linkDetailsPinned = !this.linkDetailsPinned;
            if (
              !this.linkDetailsPinned &&
              this.selectedLinkEdgeKey === '' &&
              !hasPathSelection
            ) {
              this.clearSelectedLink();
            }
          }}
        >
          ${this.linkDetailsPinned ? 'Unpin' : 'Pin'}
          <md-icon slot="icon">push_pin</md-icon>
        </md-outlined-button>
      </div>
    </aside>`;
  }

  private renderDiagramHostContent(): TemplateResult {
    if (this.switchDiagramError !== '') {
      return html`<p class="diagram-note">
        Unable to render diagram: ${this.switchDiagramError}
      </p>`;
    }

    if (this.switchDiagramSvg !== '') {
      return html`<div
        class="diagram-viewport"
        style="transform: translate(${this.diagramPanX}px, ${this
          .diagramPanY}px) scale(${this.diagramZoom});"
      >
        ${unsafeSVG(this.switchDiagramSvg)}
      </div>`;
    }

    return html`<div class="diagram-loading">
      <div class="diagram-loading-spinner"></div>
      <span class="diagram-loading-label">Generating diagram…</span>
    </div>`;
  }

  private renderDiagramMetrics(): TemplateResult {
    if (this.pathMetricsLabel === '') {
      return html``;
    }

    return html`<div class="diagram-metrics">${this.pathMetricsLabel}</div>`;
  }

  private renderDiagramContent(): TemplateResult {
    if (!this.showSwitchDiagram) {
      return html``;
    }

    if (this.switchLinks.length === 0) {
      return html`<p class="diagram-note">
        Add one or more links in CSV format to generate a diagram.
      </p>`;
    }

    return html`<div class="diagram-content-layout">
      <div
        id="switch-diagram-host"
        class=${this.isDiagramPanning
          ? 'diagram-container is-panning'
          : 'diagram-container'}
        aria-label="Network switch connectivity diagram"
        tabindex="0"
        title="${this.pathTooltip}"
        @click=${(event: Event) => {
          this.onDiagramClick(event);
        }}
        @pointerdown=${(event: PointerEvent) => {
          this.onDiagramPointerDown(event);
        }}
        @pointermove=${(event: PointerEvent) => {
          this.onDiagramPointerMove(event);
        }}
        @pointerup=${(event: PointerEvent) => {
          this.onDiagramPointerUp(event);
        }}
        @pointercancel=${(event: PointerEvent) => {
          this.onDiagramPointerUp(event);
        }}
        @wheel=${(event: WheelEvent) => {
          this.onDiagramWheel(event);
        }}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.onDiagramClick(event);
          }
        }}
      >
        ${this.renderDiagramHostContent()} ${this.renderDiagramMetrics()}
      </div>
      ${this.renderLinkDetailsPane()}
    </div>`;
  }

  render(): TemplateResult {
    return html`
      <md-tabs
        class="tab-bar"
        .activeTabIndex=${this.activeTabIndex}
        @change=${(event: Event) => {
          const target = event.currentTarget as { activeTabIndex?: number };
          this.activeTabIndex = target.activeTabIndex ?? 0;
        }}
      >
        <md-primary-tab>
          <md-icon slot="icon">table_rows</md-icon>
          Data
        </md-primary-tab>
        <md-primary-tab>
          <md-icon slot="icon">hub</md-icon>
          Diagram
        </md-primary-tab>
        <md-primary-tab>
          <md-icon slot="icon">build</md-icon>
          Configuration
        </md-primary-tab>
      </md-tabs>
      ${
        this.activeTabIndex === 0
          ? html`<section class="data-section">
              ${this.crossDatasetError
                ? html`<div class="cross-dataset-error">
                    <md-icon>error</md-icon>
                    <span>${this.crossDatasetError}</span>
                  </div>`
                : html``}
              <div class="data-section-toolbar">
                <md-outlined-button
                  class="header-button"
                  ?disabled=${!this.doc?.documentElement}
                  @click=${() => this.saveToScl()}
                  >Save to SCL
                  <md-icon slot="icon">save</md-icon>
                </md-outlined-button>
              </div>
              <div class="data-columns">
                <div class="data-column">
                  <div
                    class=${this.iedDataError
                      ? 'column-header has-error'
                      : 'column-header'}
                  >
                    <h3>IED Data</h3>
                    <div class="column-buttons">
                      <span
                        class="unused-ieds-count"
                        ?hidden=${!this.doc?.documentElement ||
                        this.unusedIedCount === 0}
                      >
                        IEDs in SCL but not network: ${this.unusedIedCount}
                      </span>
                      <md-outlined-button
                        class="header-button"
                        @click=${() => {
                          navigator.clipboard
                            .readText()
                            .then(pasteText => {
                              this.inputCsvData = pasteText;
                              this.refreshInputData();
                            })
                            .catch(() => {
                              this.showSnackbar(
                                'Failed to read clipboard. Check permissions.'
                              );
                            });
                        }}
                        >Paste
                        <md-icon slot="icon">content_paste</md-icon>
                      </md-outlined-button>
                      <md-outlined-button
                        class="header-button"
                        @click=${async () => {
                          this.importType = 'ied';
                          this.importCsvUI.click();
                        }}
                        >Import
                        <md-icon slot="icon">attach_file</md-icon>
                      </md-outlined-button>
                    </div>
                  </div>
                  <md-outlined-text-field
                    id="input"
                    type="textarea"
                    label="Input CSV data in the form: Switch Name, Port Name, IED Name, Receiving Port Name"
                    .value=${this.inputCsvData}
                    rows="100"
                    spellcheck="false"
                    @input=${(event: InputEvent) => {
                      const target = event.target as TextField;
                      this.inputCsvData = target.value;
                      this.refreshInputData();
                    }}
                    @blur=${() => {
                      if (this.iedDataError) {
                        this.showSnackbar(this.iedDataError);
                      }
                    }}
                  >
                  </md-outlined-text-field>
                </div>
                <div class="data-column">
                  <div
                    class=${this.switchLinksError
                      ? 'column-header has-error'
                      : 'column-header'}
                  >
                    <h3>Network Switch Data</h3>
                    <div class="column-buttons">
                      <md-outlined-button
                        class="header-button"
                        @click=${() => {
                          navigator.clipboard
                            .readText()
                            .then(pasteText => {
                              this.switchLinksInput = pasteText;
                              this.refreshSwitchLinks();
                            })
                            .catch(() => {
                              this.showSnackbar(
                                'Failed to read clipboard. Check permissions.'
                              );
                            });
                        }}
                        >Paste
                        <md-icon slot="icon">content_paste</md-icon>
                      </md-outlined-button>
                      <md-outlined-button
                        class="header-button"
                        @click=${async () => {
                          this.importType = 'switch';
                          this.importCsvUI.click();
                        }}
                        >Import
                        <md-icon slot="icon">attach_file</md-icon>
                      </md-outlined-button>
                    </div>
                  </div>
                  <md-outlined-text-field
                    id="switch-links"
                    type="textarea"
                    label="Input CSV data in the form: Switch A, Port 1, Switch B, Port 1"
                    .value=${this.switchLinksInput}
                    rows="100"
                    spellcheck="false"
                    @input=${(event: InputEvent) => {
                      const target = event.target as TextField;
                      this.switchLinksInput = target.value;
                      this.refreshSwitchLinks();
                    }}
                    @blur=${() => {
                      if (this.switchLinksError) {
                        this.showSnackbar(this.switchLinksError);
                      }
                    }}
                  >
                  </md-outlined-text-field>
                </div>
              </div>
            </section>`
          : html``
      }
      ${
        this.activeTabIndex === 1
          ? html`<section>
              <div class="diagram-panel">
                <div class="diagram-toolbar">
                  <div class="diagram-controls">
                    <md-filled-button
                      id="visualisation-menu-anchor"
                      class="selection-item"
                      @click=${() => {
                        this.visualisationMenuOpen = true;
                      }}
                      >Visualisation
                      <md-icon slot="icon">tune</md-icon>
                    </md-filled-button>
                    <md-menu
                      id="visualisation-menu"
                      .open=${this.visualisationMenuOpen}
                      @closed=${() => {
                        this.visualisationMenuOpen = false;
                      }}
                    >
                      <div
                        class="menu-section-title"
                        role="presentation"
                        aria-hidden="true"
                      >
                        Layout
                      </div>
                      <md-menu-item
                        @click=${() => {
                          this.diagramLayout = 'dot';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramLayout === 'dot'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Dot (layered)</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.diagramLayout = 'neato';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramLayout === 'neato'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Neato (force)</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.diagramLayout = 'fdp';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramLayout === 'fdp'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">FDP (force)</div>
                      </md-menu-item>

                      <div
                        class="menu-section-title"
                        role="presentation"
                        aria-hidden="true"
                      >
                        Spacing
                      </div>
                      <md-menu-item
                        @click=${() => {
                          this.diagramSpacing = 'compact';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramSpacing === 'compact'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Compact</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.diagramSpacing = 'normal';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramSpacing === 'normal'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Normal</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.diagramSpacing = 'expanded';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.diagramSpacing === 'expanded'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Expanded</div>
                      </md-menu-item>

                      <div
                        class="menu-section-title"
                        role="presentation"
                        aria-hidden="true"
                      >
                        Routing
                      </div>
                      <md-menu-item
                        @click=${() => {
                          this.edgeRouting = 'spline';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.edgeRouting === 'spline'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Spline</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.edgeRouting = 'polyline';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.edgeRouting === 'polyline'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Polyline</div>
                      </md-menu-item>
                      <md-menu-item
                        @click=${() => {
                          this.edgeRouting = 'ortho';
                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      >
                        <md-icon slot="start"
                          >${this.edgeRouting === 'ortho'
                            ? 'check_box'
                            : 'check_box_outline_blank'}</md-icon
                        >
                        <div slot="headline">Orthogonal</div>
                      </md-menu-item>
                    </md-menu>
                    <div
                      class="vlan-segmented-control selection-item"
                      role="group"
                      aria-label="VLAN format"
                    >
                      <span class="vlan-toggle-label">VLAN</span>
                      ${this.vlanLabelFormat === 'dec'
                        ? html`<md-filled-button
                              class="vlan-segment-button"
                              aria-pressed="true"
                              @click=${() => {
                                this.vlanLabelFormat = 'dec';
                              }}
                              >Dec</md-filled-button
                            >
                            <md-outlined-button
                              class="vlan-segment-button"
                              aria-pressed="false"
                              @click=${() => {
                                this.vlanLabelFormat = 'hex';
                              }}
                              >Hex</md-outlined-button
                            >`
                        : html`<md-outlined-button
                              class="vlan-segment-button"
                              aria-pressed="false"
                              @click=${() => {
                                this.vlanLabelFormat = 'dec';
                              }}
                              >Dec</md-outlined-button
                            >
                            <md-filled-button
                              class="vlan-segment-button"
                              aria-pressed="true"
                              @click=${() => {
                                this.vlanLabelFormat = 'hex';
                              }}
                              >Hex</md-filled-button
                            >`}
                    </div>
                    <div class="ied-slider-container">
                      <label for="show-ieds-slider" class="ied-slider-label"
                        >IEDs</label
                      >
                      <md-switch
                        id="show-ieds-slider"
                        ?selected=${this.includeIedInDiagram}
                        @change=${(event: Event) => {
                          const target = event.target as unknown as {
                            selected: boolean;
                          };
                          this.includeIedInDiagram = target.selected;

                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram();
                          }
                        }}
                      ></md-switch>
                    </div>
                    <div class="ied-slider-container">
                      <label
                        for="unsubscribed-messages-slider"
                        class="ied-slider-label"
                        >Unsubscribed</label
                      >
                      <md-switch
                        id="unsubscribed-messages-slider"
                        ?disabled=${!this.includeIedInDiagram}
                        ?selected=${this.includeUnsubscribedMessages}
                        @change=${(event: Event) => {
                          const target = event.target as unknown as {
                            selected: boolean;
                          };
                          this.includeUnsubscribedMessages = target.selected;

                          if (this.showSwitchDiagram) {
                            this.buildSwitchDiagram(false);
                          }
                        }}
                      ></md-switch>
                    </div>
                    <label class="traffic-service-option">
                      <md-checkbox
                        ?checked=${this.showGooseTraffic}
                        @change=${(event: Event) => {
                          this.showGooseTraffic = (
                            event.currentTarget as unknown as {
                              checked: boolean;
                            }
                          ).checked;
                        }}
                      ></md-checkbox>
                      <span class="ied-slider-label">GOOSE</span>
                    </label>
                    <label class="traffic-service-option">
                      <md-checkbox
                        ?checked=${this.showSvTraffic}
                        @change=${(event: Event) => {
                          this.showSvTraffic = (
                            event.currentTarget as unknown as {
                              checked: boolean;
                            }
                          ).checked;
                        }}
                      ></md-checkbox>
                      <span class="ied-slider-label">SV</span>
                    </label>
                  </div>
                  <div class="diagram-actions">
                    <md-outlined-button
                      class="selection-item"
                      ?disabled=${this.switchDiagramSvg === ''}
                      @click=${() => {
                        this.zoomToFit();
                      }}
                      >Fit
                      <md-icon slot="icon">fit_screen</md-icon>
                    </md-outlined-button>
                    <md-outlined-button
                      class="selection-item"
                      ?disabled=${this.selectedPathStart === '' &&
                      this.selectedPathEnd === '' &&
                      this.highlightedEdgeKeys.length === 0 &&
                      this.selectedLinkEdgeKey === ''}
                      @click=${() => {
                        this.clearPathSelection();
                        this.clearSelectedLink();
                      }}
                      >Clear
                      <md-icon slot="icon">close</md-icon>
                    </md-outlined-button>
                    <md-filled-button
                      id="download-menu-anchor"
                      class="selection-item"
                      ?disabled=${this.switchDiagramSvg === '' &&
                      this.switchDiagramDot === ''}
                      @click=${() => {
                        this.downloadMenuOpen = true;
                      }}
                      >Download
                      <md-icon slot="icon">download</md-icon>
                    </md-filled-button>
                    <md-menu
                      id="download-menu"
                      .open=${this.downloadMenuOpen}
                      @closed=${() => {
                        this.downloadMenuOpen = false;
                      }}
                    >
                      <md-menu-item
                        ?disabled=${this.switchDiagramSvg === ''}
                        @click=${() => {
                          this.downloadSwitchDiagramSvg();
                        }}
                      >
                        <div slot="headline">SVG</div>
                      </md-menu-item>
                      <md-menu-item
                        ?disabled=${this.switchDiagramDot === ''}
                        @click=${() => {
                          this.downloadSwitchDiagramDot();
                        }}
                      >
                        <div slot="headline">DOT</div>
                      </md-menu-item>
                    </md-menu>
                  </div>
                </div>
                ${this.renderDiagramContent()}
              </div>
            </section>`
          : html``
      }
      ${
        this.activeTabIndex === 2
          ? html`<section class="config-section">
              <div class="config-toolbar">
                <div class="config-row">
                  <md-filled-select
                    class="config-control"
                    id="iedSelect"
                    label="IED"
                    .value=${this.selectedIedName ?? 'All IEDs'}
                    @change=${(event: Event) => {
                      const target = event.currentTarget as { value?: string };
                      this.selectedIedName = target.value ?? '';
                      this.updateIedNames();
                      if (this.doc) this.buildOutputConfiguration();
                    }}
                  >
                    <md-select-option value="All IEDs">
                      <div slot="headline">All IEDs</div>
                    </md-select-option>
                    ${this.iedNames.map(
                      iedName =>
                        html`<md-select-option value="${iedName}">
                          <div slot="headline">${iedName}</div>
                        </md-select-option>`
                    )}
                  </md-filled-select>
                  <md-filled-select
                    class="config-control"
                    id="ethernetSwitch"
                    label="Switch"
                    .value=${this.selectedSwitchScope}
                    @change=${(event: Event) => {
                      const target = event.currentTarget as { value?: string };
                      this.selectedSwitchScope =
                        target.value && target.value !== ''
                          ? target.value
                          : ALL_SWITCHES_OPTION;
                      if (this.doc) this.buildOutputConfiguration();
                    }}
                  >
                    ${!this.configureSingleIedConnectivity
                      ? html`<md-select-option value="${ALL_SWITCHES_OPTION}">
                          <div slot="headline">All switches</div>
                        </md-select-option>`
                      : html``}
                    ${this.getAvailableSwitches().map(
                      switchName =>
                        html`<md-select-option value="${switchName}">
                          <div slot="headline">${switchName}</div>
                        </md-select-option>`
                    )}
                  </md-filled-select>
                  <md-filled-select
                    class="config-control"
                    label="Vendor"
                    .value=${this.switchVendor}
                    @change=${(event: Event) => {
                      const target = event.currentTarget as { value?: string };
                      this.switchVendor = target.value ?? 'cisco';
                      if (this.doc) this.buildOutputConfiguration();
                    }}
                  >
                    <md-select-option value="cisco">
                      <div slot="headline">Cisco IOS</div>
                    </md-select-option>
                    <md-select-option value="ruggedcom">
                      <div slot="headline">Ruggedcom ROS</div>
                    </md-select-option>
                  </md-filled-select>
                  <md-outlined-text-field
                    class="config-control vlan-input"
                    id="nativeVlan"
                    label="Native VLAN"
                    .value=${this.nativeVlan}
                    maxlength="5"
                    @input=${(event: InputEvent) => {
                      const target = event.target as TextField;
                      this.nativeVlan = target.value;
                      if (this.doc) this.buildOutputConfiguration();
                    }}
                  >
                  </md-outlined-text-field>
                </div>
                <div class="config-row">
                  <label class="config-toggle">
                    <md-checkbox
                      ?checked=${this.onlyConfigureIedPorts}
                      @change=${(event: Event) => {
                        const target = event.target as HTMLInputElement;
                        this.onlyConfigureIedPorts = target.checked;
                        if (this.doc) this.buildOutputConfiguration();
                      }}
                    ></md-checkbox>
                    <span>Only IED ports</span>
                  </label>
                  <label class="config-toggle">
                    <md-checkbox
                      ?checked=${this.configureSingleIedConnectivity}
                      @change=${(event: Event) => {
                        const target = event.target as HTMLInputElement;
                        this.configureSingleIedConnectivity = target.checked;
                        this.updateIedNames();
                        if (this.doc) this.buildOutputConfiguration();
                      }}
                    ></md-checkbox>
                    <span>Only directly connected</span>
                  </label>
                  <label
                    class="config-toggle"
                    ?hidden=${!this.configureSingleIedConnectivity}
                  >
                    <md-checkbox
                      ?checked=${this.includePeerIedPortsForSingleIed}
                      @change=${(event: Event) => {
                        const target = event.target as HTMLInputElement;
                        this.includePeerIedPortsForSingleIed = target.checked;
                        if (this.doc) this.buildOutputConfiguration();
                      }}
                    ></md-checkbox>
                    <span>Include peers</span>
                  </label>
                  <label class="config-toggle">
                    <md-checkbox
                      ?checked=${this.includeUnsubscribedMessages}
                      @change=${(event: Event) => {
                        const target = event.target as HTMLInputElement;
                        this.includeUnsubscribedMessages = target.checked;
                        if (this.doc) this.buildOutputConfiguration();
                      }}
                    ></md-checkbox>
                    <span>Unsubscribed messages</span>
                  </label>
                  <div class="config-button-group">
                    <md-outlined-button
                      @click=${() => {
                        navigator.permissions
                          .query({ name: 'clipboard-write' as any })
                          .then(result => {
                            if (
                              result.state === 'granted' ||
                              result.state === 'prompt'
                            ) {
                              navigator.clipboard.writeText(
                                this.outputUI?.value ?? ''
                              );
                            }
                          });
                      }}
                      >Copy
                      <md-icon slot="icon">content_copy</md-icon>
                    </md-outlined-button>
                    <md-outlined-button
                      @click=${() => {
                        const outputText = this.outputUI?.value ?? '';
                        const blob = new Blob([outputText], {
                          type: 'application/xml'
                        });
                        const a = document.createElement('a');
                        a.download = `Network_Configuration_${
                          this.ethernetSwitchUI?.value !== ''
                            ? this.ethernetSwitchUI?.value
                            : 'Unknown'
                        }.txt`;
                        a.href = URL.createObjectURL(blob);
                        a.dataset.downloadurl = [
                          'application/xml',
                          a.download,
                          a.href
                        ].join(':');
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => {
                          URL.revokeObjectURL(a.href);
                        }, 5000);
                      }}
                      >Download
                      <md-icon slot="icon">download</md-icon>
                    </md-outlined-button>
                  </div>
                </div>
              </div>
              <div class="config-output-container">
                ${!this.doc
                  ? html`<p class="diagram-note error">
                      Load an SCD file before building configuration output.
                    </p>`
                  : html``}
                <md-outlined-text-field
                  id="output"
                  type="textarea"
                  label="Output Configuration"
                  rows="5000"
                  spellcheck="false"
                >
                </md-outlined-text-field>
              </div>
            </section>`
          : html``
      }
      
      <input @click=${
        // eslint-disable-next-line no-return-assign
        (event: MouseEvent) =>
          // eslint-disable-next-line no-param-reassign
          ((<HTMLInputElement>event.target).value = '')
      } @change=${async (event: Event) => {
        const file =
          (<HTMLInputElement | null>event.target)?.files?.item(0) ?? false;
        if (!file) return;

        const fileText = await file.text();
        if (this.importType === 'ied') {
          this.inputCsvData = fileText;
          this.refreshInputData();
          this.dispatchEvent(new CustomEvent('updated-input-data-file'));
        } else if (this.importType === 'switch') {
          this.switchLinksInput = fileText;
          this.refreshSwitchLinks();
        }
      }} id="csv-input" accept=".csv,.txt" type="file"></input>

      <mwc-snackbar
        .open=${this.snackbarOpen}
        .labelText=${this.snackbarMessage}
        timeoutMs="4000"
        @closed=${() => {
          this.snackbarOpen = false;
        }}
      ></mwc-snackbar>
    `;
  }

  static styles = css`
    :host {
      --md-outlined-text-field-input-text-font: Roboto Mono;
    }

    h1,
    h2 {
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      font-weight: 300;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 0px;
      line-height: 48px;
      padding-left: 0.3em;
      transition: background-color 150ms linear;
    }

    section {
      padding: 2px 5px;
    }

    .data-section {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 160px);
      padding: 0;
    }

    .data-section-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px 0;
    }

    .data-columns {
      display: flex;
      gap: 16px;
      flex: 1;
      overflow: hidden;
      padding: 12px 16px;
    }

    .data-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .column-header.has-error h3 {
      color: #dc2626;
    }

    .cross-dataset-error {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 12px 16px;
      color: #991b1b;
      font-size: 14px;
      font-family: 'Roboto', sans-serif;
    }

    .cross-dataset-error md-icon {
      color: #dc2626;
      font-size: 20px;
    }

    .data-column h3 {
      margin: 0;
      line-height: 24px;
      font-size: 16px;
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
    }

    .column-buttons {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .unused-ieds-count {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: #dc2626;
      font-family: 'Roboto', sans-serif;
      padding-left: 6px;
      white-space: nowrap;
    }

    .unused-ieds-count[hidden] {
      display: none;
    }

    .header-button {
      font-size: 12px;
      padding: 0 8px;
      height: 32px;
    }

    #input,
    #output,
    #switch-links {
      width: 100%;
      flex: 1;
      padding: 8px;
      font-weight: 400;
      box-sizing: border-box;
      font-family: 'Roboto Mono', monospace;
      overflow: auto;
    }

    #ethernetSwitch {
      width: 300px;
    }

    #selection {
      padding: 5px;
    }

    .selection-item {
      padding: 15px;
    }

    .diagram-toggle {
      display: inline-flex;
      align-items: center;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      cursor: pointer;
      gap: 6px;
    }

    .ied-slider-container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 15px;
    }

    .vlan-segmented-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .vlan-toggle-label {
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      color: var(--mdc-theme-on-surface);
      user-select: none;
    }

    .vlan-segment-button {
      min-width: 44px;
    }

    .ied-slider-label {
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      color: var(--mdc-theme-on-surface);
      user-select: none;
    }

    .config-toggle {
      display: inline-flex;
      align-items: center;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      cursor: pointer;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      user-select: none;
    }

    .config-toggle:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    .config-section {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 160px);
      padding: 0;
      gap: 0;
    }

    .config-toolbar {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--mdc-surface);
      border-bottom: 1px solid var(--mdc-surface-dim);
      flex-shrink: 0;
    }

    .config-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .config-control {
      flex: 0 1 auto;
      min-width: 150px;
    }

    .vlan-input {
      max-width: 100px;
      flex: 0 0 auto;
    }

    .config-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .config-button-group {
      display: flex;
      gap: 8px;
      margin-left: auto;
      align-items: center;
    }

    .config-scope-summary {
      flex: 1;
      text-align: right;
      font-size: 12px;
      color: var(--mdc-on-surface-variant);
      font-family: 'Roboto', sans-serif;
      padding-right: 8px;
    }

    .config-output-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
      padding: 16px;
      gap: 8px;
    }

    .config-output-container #output {
      flex: 1;
      overflow: auto;
    }

    .config-controls {
      width: 80%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .config-controls .selection-item {
      padding-top: 6px;
      padding-bottom: 6px;
    }

    .diagram-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap;
      flex: 0 0 auto;
      margin-left: auto;
    }

    .tab-bar {
      width: 100%;
      margin-left: 0;
      margin-top: 0;
    }

    .diagram-controls {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 4px;
      flex: 1 1 auto;
      min-width: 0;
      overflow: visible;
    }

    .diagram-panel {
      width: 100%;
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 4px 0 0;
      box-sizing: border-box;
      height: calc(100vh - 160px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .diagram-toolbar {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      overflow: visible;
    }

    .diagram-toolbar .selection-item,
    .diagram-toolbar .ied-slider-container {
      padding: 6px;
    }

    .menu-section-title {
      padding: 8px 16px 4px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--mdc-theme-on-surface);
      opacity: 0.72;
      user-select: none;
      pointer-events: none;
    }

    .diagram-container {
      width: 100%;
      margin-top: 8px;
      border: none;
      border-radius: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: auto;
      flex: 1;
      position: relative;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .diagram-container.is-panning {
      cursor: grabbing;
    }

    .diagram-content-layout {
      display: flex;
      align-items: stretch;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }

    .diagram-viewport {
      transform-origin: 0 0;
      width: max-content;
    }

    .diagram-metrics {
      position: absolute;
      right: 12px;
      bottom: 12px;
      font-family: 'Roboto', sans-serif;
      font-size: 12px;
      color: var(--mdc-theme-on-surface);
      background: transparent;
      padding: 4px 6px;
      pointer-events: none;
    }

    .diagram-pan-hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      opacity: 0.7;
    }

    .diagram-container svg g.node[data-node] {
      cursor: pointer;
    }

    .diagram-container svg g.node ellipse,
    .diagram-container svg g.node polygon,
    .diagram-container svg g.node path,
    .diagram-container svg g.edge path,
    .diagram-container svg g.edge polygon {
      stroke: var(--oscd-theme-secondary);
    }

    .diagram-container svg g.node.path-active ellipse,
    .diagram-container svg g.node.path-active polygon,
    .diagram-container svg g.node.path-active path {
      stroke: var(--oscd-theme-primary);
      stroke-width: 1.8;
    }

    /* Selected start node — solid blue fill, white text */
    .diagram-container svg g.node.path-start ellipse,
    .diagram-container svg g.node.path-start polygon,
    .diagram-container svg g.node.path-start path {
      fill: #2563eb !important;
      stroke: #1d4ed8;
      stroke-width: 2.4;
    }
    .diagram-container svg g.node.path-start text {
      fill: #ffffff !important;
    }

    /* Selected end node — solid violet fill, white text */
    .diagram-container svg g.node.path-end ellipse,
    .diagram-container svg g.node.path-end polygon,
    .diagram-container svg g.node.path-end path {
      fill: #7c3aed !important;
      stroke: #6d28d9;
      stroke-width: 2.4;
    }
    .diagram-container svg g.node.path-end text {
      fill: #ffffff !important;
    }

    /* Receiver IEDs (downstream of selected) — amber fill, dark text */
    .diagram-container svg g.node.ied-receiver-highlight ellipse,
    .diagram-container svg g.node.ied-receiver-highlight polygon,
    .diagram-container svg g.node.ied-receiver-highlight path {
      fill: #f59e0b !important;
      stroke: #d97706;
      stroke-width: 2;
      opacity: 1;
    }
    .diagram-container svg g.node.ied-receiver-highlight text {
      fill: #1c1917 !important;
    }

    /* Sender IEDs (upstream of selected) — teal fill, white text */
    .diagram-container svg g.node.ied-sender-highlight ellipse,
    .diagram-container svg g.node.ied-sender-highlight polygon,
    .diagram-container svg g.node.ied-sender-highlight path {
      fill: #0d9488 !important;
      stroke: #0f766e;
      stroke-width: 2;
      opacity: 1;
    }
    .diagram-container svg g.node.ied-sender-highlight text {
      fill: #ffffff !important;
    }

    .diagram-container svg g.edge.path-active path,
    .diagram-container svg g.edge.path-active polygon {
      stroke: var(--oscd-theme-primary);
      opacity: 1;
      stroke-width: 1.8;
    }

    .diagram-container svg g.edge.path-shortest path,
    .diagram-container svg g.edge.path-shortest polygon {
      stroke: var(--oscd-theme-primary);
      stroke-dasharray: 6 3;
    }

    .diagram-container svg g.edge.link-selected path,
    .diagram-container svg g.edge.link-selected polygon {
      stroke: var(--oscd-theme-primary);
      opacity: 1;
      stroke-width: 2.4;
    }

    /* IED single-select edge colouring */
    /* Amber: traffic published by the selected IED (flows out to receivers) */
    .diagram-container svg g.edge.ied-publisher-edge path,
    .diagram-container svg g.edge.ied-publisher-edge polygon {
      stroke: #d97706;
      stroke-width: 2.4;
      opacity: 1;
    }

    /* Teal: traffic received by the selected IED (flows in from senders) */
    .diagram-container svg g.edge.ied-subscriber-edge path,
    .diagram-container svg g.edge.ied-subscriber-edge polygon {
      stroke: #0d9488;
      stroke-width: 2.4;
      opacity: 1;
    }

    /* Both: amber stroke with teal drop-shadow glow to show dual use */
    .diagram-container svg g.edge.ied-both-edge path,
    .diagram-container svg g.edge.ied-both-edge polygon {
      stroke: #d97706;
      stroke-width: 2.8;
      opacity: 1;
      filter: drop-shadow(0 0 3px #0d9488);
    }

    .diagram-container svg g.edge text {
      fill: var(--oscd-theme-base00);
    }

    .diagram-container
      svg
      g.edge:hover:not(.path-active):not(.path-shortest)
      path,
    .diagram-container
      svg
      g.edge:hover:not(.path-active):not(.path-shortest)
      polygon {
      opacity: 0.85;
      stroke-width: 2.25;
    }

    .diagram-container svg g.node.path-muted,
    .diagram-container svg g.edge.path-muted {
      opacity: 0.25;
    }

    .link-details-pane {
      width: 340px;
      max-width: 40vw;
      min-width: 280px;
      border-left: 1px solid var(--mdc-surface-dim);
      background: var(--mdc-surface);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .link-details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
      padding: 10px 10px 6px;
      background: var(--mdc-surface);
      border-bottom: 1px solid var(--mdc-surface-dim);
    }

    .link-details-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .link-details-header h3 {
      margin: 0;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: var(--mdc-theme-on-surface);
    }

    .traffic-service-filters {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-left: auto;
    }

    .traffic-service-option {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
      opacity: 0.9;
    }

    .link-pin-button {
      min-width: 80px;
    }

    .link-details-selection {
      margin: 6px 0 8px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .ied-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--oscd-theme-text-font-mono, 'Roboto Mono'), monospace;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .ied-chip--selected {
      background: #2563eb;
      color: #ffffff;
    }

    .ied-chip--end {
      background: #7c3aed;
      color: #ffffff;
    }

    .ied-chip--receiver {
      background: #f59e0b;
      color: #1c1917;
    }

    .ied-chip--sender {
      background: #0d9488;
      color: #ffffff;
    }

    .ied-arrow {
      font-size: 12px;
      opacity: 0.6;
      flex-shrink: 0;
    }

    .link-traffic-group h4 {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .traffic-direction-title {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .title-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .title-dot--selected {
      background: #2563eb;
    }

    .title-dot--end {
      background: #7c3aed;
    }

    .title-dot--sender {
      background: #0d9488;
    }

    .link-details-vlans {
      margin: -2px 0 6px;
      font-family: var(--oscd-theme-text-font-mono, 'Roboto Mono'), monospace;
      font-size: 11px;
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
      opacity: 0.85;
      word-break: break-word;
    }

    .link-details-path {
      margin: -4px 0 8px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
      opacity: 0.75;
    }

    .traffic-direction-section {
      margin-bottom: 8px;
    }

    .traffic-direction-title {
      margin: 6px 0 4px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: var(--mdc-theme-on-surface);
      opacity: 0.9;
    }

    .link-traffic-group {
      padding-bottom: 6px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--mdc-surface-dim);
    }

    .link-traffic-group h4,
    .link-traffic-group h5 {
      margin: 6px 0 3px;
      font-family: 'Roboto', sans-serif;
      color: var(--mdc-theme-on-surface);
    }

    .link-traffic-group h4 {
      font-size: 14px;
      font-weight: 600;
    }

    .link-traffic-group h5 {
      font-size: 13px;
      font-weight: 600;
      opacity: 0.9;
    }

    .link-service-block {
      margin-bottom: 6px;
    }

    .link-traffic-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--mdc-surface-dim);
      border-radius: 6px;
      overflow: hidden;
      background: color-mix(
        in srgb,
        var(--mdc-surface) 94%,
        var(--mdc-theme-on-surface) 6%
      );
    }

    .link-traffic-table th,
    .link-traffic-table td {
      padding: 4px 6px;
      text-align: left;
      font-size: 11px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
      color: var(--mdc-theme-on-surface);
      border-bottom: 1px solid var(--mdc-surface-dim);
    }

    .link-traffic-table .vlan-cell,
    .link-traffic-table .mac-cell {
      font-family: var(--oscd-theme-text-font-mono, 'Roboto Mono'), monospace;
      letter-spacing: 0.02em;
      font-size: 11px;
    }

    .link-traffic-table th {
      font-weight: 600;
      opacity: 0.9;
      background: color-mix(
        in srgb,
        var(--mdc-surface) 85%,
        var(--mdc-theme-on-surface) 15%
      );
    }

    .link-traffic-table tr:last-child td {
      border-bottom: none;
    }

    .link-details-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      background: var(--mdc-surface);
      padding: 8px 10px;
      border-top: 1px solid var(--mdc-surface-dim);
    }

    .diagram-note {
      color: var(--mdc-theme-on-surface);
      margin: 8px 0 0 6px;
      font-family: 'Roboto', sans-serif;
    }

    .diagram-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      height: 100%;
      min-height: 200px;
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      opacity: 0.7;
    }

    .diagram-loading-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--mdc-surface-dim, #e0e0e0);
      border-top-color: var(--oscd-theme-primary, #1d4ed8);
      border-radius: 50%;
      animation: diagram-spin 0.8s linear infinite;
    }

    .diagram-loading-label {
      font-size: 13px;
    }

    @keyframes diagram-spin {
      to {
        transform: rotate(360deg);
      }
    }

    svg {
      width: 100%;
      height: auto;
      min-height: 320px;
      font-family: var(--oscd-theme-text-font, 'Roboto'), sans-serif;
    }

    .node-circle {
      fill: transparent;
      stroke: var(--mdc-theme-on-surface);
      stroke-width: 2;
    }

    .node-label,
    .edge-label {
      fill: var(--mdc-theme-on-surface);
      font-size: 12px;
    }

    input {
      width: 0;
      height: 0;
      opacity: 0;
    }

    .error {
      color: red;
    }

    md-outlined-text-field {
      resize: vertical;
    }

    #input,
    #output,
    #switch-links,
    .diagram-container,
    .link-details-body {
      scrollbar-width: thin;
    }

    @media (prefers-color-scheme: dark) {
      #input,
      #output,
      #switch-links,
      .diagram-container,
      .link-details-body {
        scrollbar-color: color-mix(
            in srgb,
            var(--mdc-theme-on-surface) 35%,
            var(--mdc-surface) 65%
          )
          color-mix(
            in srgb,
            var(--mdc-surface) 75%,
            var(--mdc-theme-on-surface) 25%
          );
      }

      #input::-webkit-scrollbar,
      #output::-webkit-scrollbar,
      #switch-links::-webkit-scrollbar,
      .diagram-container::-webkit-scrollbar,
      .link-details-body::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      #input::-webkit-scrollbar-track,
      #output::-webkit-scrollbar-track,
      #switch-links::-webkit-scrollbar-track,
      .diagram-container::-webkit-scrollbar-track,
      .link-details-body::-webkit-scrollbar-track {
        background: color-mix(
          in srgb,
          var(--mdc-surface) 75%,
          var(--mdc-theme-on-surface) 25%
        );
        border-radius: 4px;
      }

      #input::-webkit-scrollbar-thumb,
      #output::-webkit-scrollbar-thumb,
      #switch-links::-webkit-scrollbar-thumb,
      .diagram-container::-webkit-scrollbar-thumb,
      .link-details-body::-webkit-scrollbar-thumb {
        background: color-mix(
          in srgb,
          var(--mdc-theme-on-surface) 35%,
          var(--mdc-surface) 65%
        );
        border-radius: 4px;
        border: 2px solid
          color-mix(
            in srgb,
            var(--mdc-surface) 75%,
            var(--mdc-theme-on-surface) 25%
          );
      }

      #input::-webkit-scrollbar-thumb:hover,
      #output::-webkit-scrollbar-thumb:hover,
      #switch-links::-webkit-scrollbar-thumb:hover,
      .diagram-container::-webkit-scrollbar-thumb:hover,
      .link-details-body::-webkit-scrollbar-thumb:hover {
        background: color-mix(
          in srgb,
          var(--mdc-theme-on-surface) 50%,
          var(--mdc-surface) 50%
        );
      }
    }
  `;
}
