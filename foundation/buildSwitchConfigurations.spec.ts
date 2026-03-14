import { expect } from '@open-wc/testing';

import {
  buildCiscoConfigurationText,
  buildRuggedcomConfigurationText,
  type ConfigPortDataEntry,
  type SwitchLink,
  type BuildSwitchConfigOptions
} from './buildSwitchConfigurations.js';
import { type IedTraffic } from './sclTraffic.js';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const gooseMac = '01-0C-CD-01-00-01';
const gooseEthType = '0x88B8';
const smvMac = '01-0C-CD-04-00-01';
const smvEthType = '0x88BA';

// Two-switch topology: Publisher on Sw1, Subscriber on Sw2.
// Sw1::GE2 <-> Sw2::GE2 is the inter-switch link.
const portData: ConfigPortDataEntry[] = [
  {
    switchName: 'Sw1',
    portName: 'GE1',
    iedName: 'Publisher',
    receivingPortName: 'PortA'
  },
  {
    switchName: 'Sw2',
    portName: 'GE1',
    iedName: 'Subscriber',
    receivingPortName: 'PortB'
  }
];

const switchLinks: SwitchLink[] = [
  {
    sourceSwitch: 'Sw1',
    sourcePort: 'GE2',
    targetSwitch: 'Sw2',
    targetPort: 'GE2'
  }
];

const iedPorts = new Set(['Publisher', 'Subscriber']);

const publishedTrafficByIed = new Map([
  ['Publisher', [{ mac: gooseMac, ethType: gooseEthType, vlan: 100 }]]
]);

const subscribedTrafficByIed = new Map([
  ['Subscriber', [{ mac: gooseMac, ethType: gooseEthType, vlan: 100 }]]
]);

const iedTrafficIndex = new Map<string, IedTraffic>([
  [
    'Publisher',
    {
      vlans: [100],
      publishEntries: [{ mac: gooseMac, ethType: gooseEthType }],
      subscribeEntries: [],
      manufacturer: 'ACME',
      type: 'Relay'
    }
  ],
  [
    'Subscriber',
    {
      vlans: [100],
      publishEntries: [],
      subscribeEntries: [{ mac: gooseMac, ethType: gooseEthType }],
      manufacturer: 'Siemens',
      type: 'IED'
    }
  ]
]);

const defaultOptions: BuildSwitchConfigOptions = {
  allSwitchesOption: 'All Switches',
  configureSingleIedConnectivity: false,
  selectedIedName: '',
  includePeerIedPortsForSingleIed: false,
  selectedSwitchScope: '',
  onlyConfigureIedPorts: false,
  includeUnsubscribedMessages: false,
  nativeVlan: '1'
};

const baseArgs = {
  portData,
  switchLinks,
  iedPorts,
  iedTrafficIndex,
  publishedTrafficByIed,
  subscribedTrafficByIed,
  options: defaultOptions
};

// ---------------------------------------------------------------------------
// buildCiscoConfigurationText
// ---------------------------------------------------------------------------

describe('buildCiscoConfigurationText', () => {
  it('returns an empty string when single-IED mode is on but no IED is selected', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: ''
      }
    });
    expect(result).to.equal('');
  });

  it('generates a config block for each switch in the topology', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('Cisco IOS configuration for switch Sw1');
    expect(result).to.contain('Cisco IOS configuration for switch Sw2');
  });

  it('generates an interface block with correct IED port description', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('description Sw1 IED trunk to Publisher PortA');
    expect(result).to.contain('description Sw2 IED trunk to Subscriber PortB');
  });

  it('sets switchport mode trunk on IED ports', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('switchport mode trunk');
  });

  it('sets native VLAN from options.nativeVlan', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('switchport trunk native vlan 1');
  });

  it('includes the data VLAN in allowed VLANs for IED ports', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    // Native VLAN 1 plus data VLAN 100
    expect(result).to.contain('switchport trunk allowed vlan 1,100');
  });

  it('generates a MAC ACL for the publisher port (ingress)', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('mac access-list extended');
    // Publisher port should have an ingress ACL
    expect(result).to.contain('mac access-group');
    expect(result).to.contain(' in');
  });

  it('includes the GOOSE MAC address in the publisher ACL', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    // Cisco format: dashes replaced with dots
    expect(result).to.contain('01.0C.CD.01.00.01');
    expect(result).to.contain('0x88B8');
  });

  it('generates a MAC ACL for the subscriber port (egress)', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain(' out');
  });

  it('generates inter-switch uplink interface blocks', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('description Sw1 uplink to Sw2 GE2');
    expect(result).to.contain('description Sw2 uplink to Sw1 GE2');
  });

  it('omits inter-switch uplink blocks when onlyConfigureIedPorts is true', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      options: { ...defaultOptions, onlyConfigureIedPorts: true }
    });
    expect(result).to.not.contain('uplink to');
  });

  it('shows "All IEDs" scope label when not in single-IED mode', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('Active scope: All IEDs');
  });

  it('shows the selected IED name in the scope label in single-IED mode', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: 'Publisher'
      }
    });
    expect(result).to.contain('Active scope: IED Publisher');
  });

  it('appends " + peers" to the scope label when includePeerIedPortsForSingleIed is true', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: 'Publisher',
        includePeerIedPortsForSingleIed: true
      }
    });
    expect(result).to.contain('IED Publisher + peers');
  });

  it('generates config only for the selected switch when selectedSwitchScope is set', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      options: { ...defaultOptions, selectedSwitchScope: 'Sw1' }
    });
    expect(result).to.contain('switch Sw1');
    expect(result).to.not.contain('switch Sw2');
  });

  it('ends each switch block with "end"', () => {
    const result = buildCiscoConfigurationText(baseArgs);
    expect(result).to.contain('\nend');
  });

  it('includes unsubscribed published messages when includeUnsubscribedMessages is true', () => {
    // Create a publisher with traffic that has no matching subscription
    const pub = new Map([
      [
        'Publisher',
        [
          { mac: gooseMac, ethType: gooseEthType, vlan: 100 },
          { mac: '01-0C-CD-01-00-FF', ethType: gooseEthType, vlan: 999 }
        ]
      ]
    ]);
    const sub = new Map<
      string,
      { mac: string; ethType: string; vlan: number }[]
    >(); // empty — no subscribers

    const result = buildCiscoConfigurationText({
      ...baseArgs,
      publishedTrafficByIed: pub,
      subscribedTrafficByIed: sub,
      options: { ...defaultOptions, includeUnsubscribedMessages: true }
    });
    // VLAN 999 should appear in allowed list
    expect(result).to.contain('999');
  });

  it('returns an empty string when there are no switches to configure', () => {
    const result = buildCiscoConfigurationText({
      ...baseArgs,
      portData: [],
      switchLinks: []
    });
    expect(result).to.equal('');
  });
});

// ---------------------------------------------------------------------------
// buildRuggedcomConfigurationText
// ---------------------------------------------------------------------------

describe('buildRuggedcomConfigurationText', () => {
  it('returns an empty string when single-IED mode is on but no IED is selected', () => {
    const result = buildRuggedcomConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: ''
      }
    });
    expect(result).to.equal('');
  });

  it('generates a config block for each switch', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('RST2228 ROS configuration for switch Sw1');
    expect(result).to.contain('RST2228 ROS configuration for switch Sw2');
  });

  it('generates ROS interface commands for IED ports', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    // Publisher on Sw1::GE1
    expect(result).to.contain(
      'ros interface set port GE1 description "Sw1 IED trunk to Publisher PortA"'
    );
  });

  it('sets vlan-type trunk on IED ports', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('ros interface set port GE1 vlan-type trunk');
  });

  it('sets pvid from options.nativeVlan', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('ros interface set port GE1 pvid 1');
  });

  it('includes data VLANs in vlan-allowed for IED ports', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    // Publisher port should have VLAN 100 allowed
    expect(result).to.contain('vlan-allowed 1,100');
  });

  it('generates ros acl set command for publisher ingress ACL', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('ros acl set id');
    expect(result).to.contain('direction ingress');
  });

  it('generates ros mac-ace entries for GOOSE MAC address', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain(`dst-mac ${gooseMac}`);
    expect(result).to.contain(`ethtype ${gooseEthType}`);
  });

  it('generates a deny ACE for each ethType after allow entries', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('action deny');
  });

  it('generates ros acl set id ... status active to enable ACLs', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('status active');
  });

  it('includes ACL rollback commands at the end of each switch block', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('ros acl delete id');
  });

  it('ends each switch block with "save"', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('\nsave');
  });

  it('generates uplink interface descriptions for inter-switch links', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('uplink to Sw2 GE2');
    expect(result).to.contain('uplink to Sw1 GE2');
  });

  it('omits inter-switch uplink blocks when onlyConfigureIedPorts is true', () => {
    const result = buildRuggedcomConfigurationText({
      ...baseArgs,
      options: { ...defaultOptions, onlyConfigureIedPorts: true }
    });
    expect(result).to.not.contain('uplink to');
  });

  it('generates a scope note in single-IED mode', () => {
    const result = buildRuggedcomConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: 'Publisher'
      }
    });
    expect(result).to.contain('Scope limited to IED Publisher');
  });

  it('appends peer suffix to scope note when includePeerIedPortsForSingleIed is true', () => {
    const result = buildRuggedcomConfigurationText({
      ...baseArgs,
      options: {
        ...defaultOptions,
        configureSingleIedConnectivity: true,
        selectedIedName: 'Publisher',
        includePeerIedPortsForSingleIed: true
      }
    });
    expect(result).to.contain('plus communicating peer IED ports');
  });

  it('generates config only for the selected switch when selectedSwitchScope is set', () => {
    const result = buildRuggedcomConfigurationText({
      ...baseArgs,
      options: { ...defaultOptions, selectedSwitchScope: 'Sw1' }
    });
    expect(result).to.contain('switch Sw1');
    expect(result).to.not.contain('switch Sw2');
  });

  it('binds ingress ACL to publisher port', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    // Publisher publishes, so its port should have an ingress ACL bound
    expect(result).to.contain('direction ingress');
  });

  it('binds egress ACL to subscriber port', () => {
    const result = buildRuggedcomConfigurationText(baseArgs);
    expect(result).to.contain('direction egress');
  });

  it('generates separate blocks for SMV traffic with 0x88BA ethType', () => {
    const smvPortData: ConfigPortDataEntry[] = [
      {
        switchName: 'Sw1',
        portName: 'GE1',
        iedName: 'SMV_Publisher',
        receivingPortName: 'PortA'
      }
    ];
    const smvIedPorts = new Set(['SMV_Publisher']);
    const smvPublished = new Map([
      ['SMV_Publisher', [{ mac: smvMac, ethType: smvEthType, vlan: 200 }]]
    ]);
    const smvTrafficIndex = new Map<string, IedTraffic>([
      [
        'SMV_Publisher',
        {
          vlans: [200],
          publishEntries: [{ mac: smvMac, ethType: smvEthType }],
          subscribeEntries: [],
          manufacturer: 'SEL',
          type: 'SEL_411L'
        }
      ]
    ]);

    const result = buildRuggedcomConfigurationText({
      portData: smvPortData,
      switchLinks: [],
      iedPorts: smvIedPorts,
      iedTrafficIndex: smvTrafficIndex,
      publishedTrafficByIed: smvPublished,
      subscribedTrafficByIed: new Map(),
      options: defaultOptions
    });

    expect(result).to.contain(smvMac);
    expect(result).to.contain(smvEthType);
  });
});
