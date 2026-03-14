import {
  type IedTraffic,
  type MacFilterEntry,
  type SubscribedTrafficEntry
} from './sclTraffic.js';

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

const emptyIedTraffic: IedTraffic = {
  vlans: [],
  publishEntries: [],
  subscribeEntries: [],
  manufacturer: 'Unknown',
  type: 'Unknown'
};

const toTrafficKey = (entry: MacFilterEntry) => `${entry.ethType}|${entry.mac}`;

function getScopedIeds(
  portData: ConfigPortDataEntry[],
  iedPorts: Set<string>,
  iedTrafficIndex: Map<string, IedTraffic>,
  options: BuildSwitchConfigOptions
): string[] {
  const allConfiguredIeds = [
    ...new Set(
      portData
        .filter(portInfo => iedPorts.has(portInfo.iedName))
        .map(portInfo => portInfo.iedName)
    )
  ];

  if (!options.configureSingleIedConnectivity) return allConfiguredIeds;

  const selectedTraffic =
    iedTrafficIndex.get(options.selectedIedName) ?? emptyIedTraffic;
  const selectedTrafficKeys = new Set<string>([
    ...selectedTraffic.publishEntries.map(toTrafficKey),
    ...selectedTraffic.subscribeEntries.map(toTrafficKey)
  ]);

  return allConfiguredIeds.filter(iedName => {
    if (iedName === options.selectedIedName) return true;
    if (!options.includePeerIedPortsForSingleIed) return false;

    const peerTraffic = iedTrafficIndex.get(iedName) ?? emptyIedTraffic;
    return [...peerTraffic.publishEntries, ...peerTraffic.subscribeEntries]
      .map(toTrafficKey)
      .some(trafficKey => selectedTrafficKeys.has(trafficKey));
  });
}

function getRuggedcomScopeNote(options: BuildSwitchConfigOptions): string {
  if (!options.configureSingleIedConnectivity) {
    return '';
  }

  const peerSuffix = options.includePeerIedPortsForSingleIed
    ? ' plus communicating peer IED ports'
    : '';
  return `# - Scope limited to IED ${options.selectedIedName}${peerSuffix} and required transit connectivity.`;
}

function getCiscoScopeLabel(options: BuildSwitchConfigOptions): string {
  if (!options.configureSingleIedConnectivity) {
    return 'All IEDs';
  }

  const peerSuffix = options.includePeerIedPortsForSingleIed ? ' + peers' : '';
  return `IED ${options.selectedIedName}${peerSuffix}`;
}

const buildSubscribedTrafficKeys = (
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>
): Set<string> => {
  const keys = new Set<string>();
  subscribedTrafficByIed.forEach(entries => {
    entries.forEach(entry => {
      if (entry.mac === '' || entry.ethType === '') return;
      keys.add(toTrafficKey(entry));
    });
  });
  return keys;
};

const buildIedPortVlans = (
  iedName: string,
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>,
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>,
  subscribedTrafficKeys: Set<string>,
  includeUnsubscribedMessages: boolean
): number[] => {
  const subscribedVlans = (subscribedTrafficByIed.get(iedName) ?? [])
    .map(entry => entry.vlan)
    .filter(vlan => vlan !== 0);

  const publishedVlans = (publishedTrafficByIed.get(iedName) ?? [])
    .filter(entry => {
      if (entry.vlan === 0) return false;
      if (includeUnsubscribedMessages) return true;
      return subscribedTrafficKeys.has(toTrafficKey(entry));
    })
    .map(entry => entry.vlan);

  return [...new Set([...subscribedVlans, ...publishedVlans])].sort(
    (a, b) => a - b
  );
};

export function buildRuggedcomConfigurationText(args: {
  portData: ConfigPortDataEntry[];
  switchLinks: SwitchLink[];
  iedPorts: Set<string>;
  iedTrafficIndex: Map<string, IedTraffic>;
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  options: BuildSwitchConfigOptions;
}): string {
  const {
    portData,
    switchLinks,
    iedPorts,
    iedTrafficIndex,
    publishedTrafficByIed,
    subscribedTrafficByIed,
    options
  } = args;

  if (
    options.configureSingleIedConnectivity &&
    options.selectedIedName === ''
  ) {
    return '';
  }

  const scopedIeds = getScopedIeds(
    portData,
    iedPorts,
    iedTrafficIndex,
    options
  );

  const subscribedTrafficKeys = buildSubscribedTrafficKeys(
    subscribedTrafficByIed
  );

  const selectedEthernetSwitch =
    options.selectedSwitchScope !== ''
      ? options.selectedSwitchScope
      : options.allSwitchesOption;

  let switchesToConfigure: string[] = [];
  if (
    selectedEthernetSwitch !== options.allSwitchesOption &&
    selectedEthernetSwitch !== ''
  ) {
    switchesToConfigure = [selectedEthernetSwitch];
  } else {
    const switchesFromScopedIeds = new Set(
      portData
        .filter(
          portInfo =>
            iedPorts.has(portInfo.iedName) &&
            scopedIeds.includes(portInfo.iedName)
        )
        .map(portInfo => portInfo.switchName)
    );

    if (!options.onlyConfigureIedPorts) {
      switchLinks.forEach(link => {
        if (link.sourceSwitch !== '')
          switchesFromScopedIeds.add(link.sourceSwitch);
        if (link.targetSwitch !== '')
          switchesFromScopedIeds.add(link.targetSwitch);
      });
    }

    switchesToConfigure = Array.from(switchesFromScopedIeds)
      .filter(name => name !== '')
      .sort((a, b) => a.localeCompare(b));
  }

  const allNetworkVlans = new Set<number>();
  const directionalMacBySwitchPort = new Map<
    string,
    Map<string, { ingress: Set<string>; egress: Set<string> }>
  >();

  const addDirectionalTraffic = (
    switchName: string,
    portName: string,
    ingressKeys: string[],
    egressKeys: string[]
  ) => {
    if (!directionalMacBySwitchPort.has(switchName)) {
      directionalMacBySwitchPort.set(switchName, new Map());
    }

    const switchPortTraffic = directionalMacBySwitchPort.get(switchName)!;
    if (!switchPortTraffic.has(portName)) {
      switchPortTraffic.set(portName, {
        ingress: new Set<string>(),
        egress: new Set<string>()
      });
    }

    const traffic = switchPortTraffic.get(portName)!;
    ingressKeys.forEach(key => traffic.ingress.add(key));
    egressKeys.forEach(key => traffic.egress.add(key));
  };

  const scopedTrafficKeys = new Set<string>();
  scopedIeds.forEach(iedName => {
    const traffic = iedTrafficIndex.get(iedName) ?? emptyIedTraffic;
    traffic.vlans.forEach(vlan => allNetworkVlans.add(vlan));

    traffic.publishEntries
      .map(toTrafficKey)
      .forEach(key => scopedTrafficKeys.add(key));
    traffic.subscribeEntries
      .map(toTrafficKey)
      .forEach(key => scopedTrafficKeys.add(key));
  });

  if (!options.onlyConfigureIedPorts) {
    const allKeys = Array.from(scopedTrafficKeys);
    switchLinks.forEach(link => {
      addDirectionalTraffic(
        link.sourceSwitch,
        link.sourcePort,
        allKeys,
        allKeys
      );
      addDirectionalTraffic(
        link.targetSwitch,
        link.targetPort,
        allKeys,
        allKeys
      );
    });
  }

  const buildAclName = (
    switchName: string,
    portName: string,
    direction: 'in' | 'out'
  ) =>
    `al-${switchName.replace(/[^A-Za-z0-9]/g, '_')}-${portName.replace(
      /[^A-Za-z0-9]/g,
      '_'
    )}-${direction}`;

  const parseTrafficKey = (trafficKey: string): MacFilterEntry => {
    const [ethType, mac] = trafficKey.split('|');
    return { ethType, mac };
  };

  const normalizeEntries = (entries: MacFilterEntry[]) =>
    Array.from(
      new Map(
        entries.map(entry => [`${entry.ethType}|${entry.mac}`, entry])
      ).values()
    ).sort((a, b) =>
      `${a.ethType}|${a.mac}`.localeCompare(`${b.ethType}|${b.mac}`)
    );

  const buildAclConfigLines = (
    aclId: string,
    direction: 'ingress' | 'egress',
    portName: string,
    entries: MacFilterEntry[]
  ) => {
    const normalizedEntries = normalizeEntries(entries);
    if (normalizedEntries.length === 0) return [];

    const lines: string[] = [
      `ros acl set id "${aclId}" direction ${direction} implicit-action permit ports ${portName} status inactive`
    ];

    normalizedEntries.forEach((entry, index) => {
      lines.push(
        `ros mac-ace set acl-id "${aclId}" pri ${
          index + 1
        } incl yes action permit src-mac ANY src-mask 00-00-00-00-00-00 dst-mac ${
          entry.mac
        } dst-mask FF-FF-FF-FF-FF-FF ethtype ${
          entry.ethType
        } vid ANY vlanpri ANY`
      );
    });

    const ethTypes = [
      ...new Set(normalizedEntries.map(entry => entry.ethType))
    ].sort((a, b) => a.localeCompare(b));
    ethTypes.forEach((ethType, index) => {
      lines.push(
        `ros mac-ace set acl-id "${aclId}" pri ${
          normalizedEntries.length + index + 1
        } incl yes action deny src-mac ANY src-mask 00-00-00-00-00-00 dst-mac ANY dst-mask 00-00-00-00-00-00 ethtype ${ethType} vid ANY vlanpri ANY`
      );
    });

    lines.push(`ros acl set id "${aclId}" status active`);
    return lines;
  };

  const switchConfigBlocks = switchesToConfigure.map(currentSwitch => {
    const accessListsIn: string[] = [];
    const accessListsOut: string[] = [];
    const aclNames = new Set<string>();
    const aclRemovalCommand: string[] = [];
    const vlansOnSwitch: Set<number> = new Set();

    const portsToConfigure = portData
      .filter(
        port =>
          port.switchName === currentSwitch &&
          iedPorts.has(port.iedName) &&
          (!options.configureSingleIedConnectivity ||
            port.iedName === options.selectedIedName)
      )
      .map(portInfo => {
        const { iedName } = portInfo;
        const traffic = iedTrafficIndex.get(iedName) ?? emptyIedTraffic;
        const { publishEntries, subscribeEntries, manufacturer, type } =
          traffic;
        const vlans = buildIedPortVlans(
          iedName,
          publishedTrafficByIed,
          subscribedTrafficByIed,
          subscribedTrafficKeys,
          options.includeUnsubscribedMessages
        );

        vlans.forEach(vlan => vlansOnSwitch.add(vlan));

        const macFilterInACL = buildAclName(
          currentSwitch,
          portInfo.portName,
          'in'
        );
        const macFilterOutACL = buildAclName(
          currentSwitch,
          portInfo.portName,
          'out'
        );

        const inAclName = `ros acl set id "${macFilterInACL}" direction ingress implicit-action permit ports ${portInfo.portName} status inactive`;
        if (publishEntries.length > 0 && !aclNames.has(inAclName)) {
          accessListsIn.push(
            buildAclConfigLines(
              macFilterInACL,
              'ingress',
              portInfo.portName,
              publishEntries
            ).join('\n')
          );
          aclRemovalCommand.push(`ros acl delete id "${macFilterInACL}"`);
          aclNames.add(inAclName);
        }

        const outAclName = `ros acl set id "${macFilterOutACL}" direction egress implicit-action permit ports ${portInfo.portName} status inactive`;
        if (subscribeEntries.length > 0 && !aclNames.has(outAclName)) {
          accessListsOut.push(
            buildAclConfigLines(
              macFilterOutACL,
              'egress',
              portInfo.portName,
              subscribeEntries
            ).join('\n')
          );
          aclRemovalCommand.push(`ros acl delete id "${macFilterOutACL}"`);
          aclNames.add(outAclName);
        }

        return `ros interface set port ${
          portInfo.portName
        } description "${currentSwitch} IED trunk to ${iedName} ${
          portInfo.receivingPortName
        }"
ros interface set port ${portInfo.portName} vlan-type trunk
ros interface set port ${portInfo.portName} pvid ${options.nativeVlan}
ros interface set port ${portInfo.portName} native-tagging untagged
ros interface set port ${portInfo.portName} vlan-allowed ${options.nativeVlan}${
          vlans.length > 0 ? `,${vlans.join(',')}` : ''
        }${
          manufacturer === 'SEL' &&
          (type === 'SEL_411L_2S' || type === 'SEL_487E_5S')
            ? `\n! NOTE: Legacy SEL port speed handling may require manual review on ROS`
            : ''
        }${
          subscribeEntries.length > 0
            ? `\nros acl bind id "${macFilterOutACL}" port ${portInfo.portName} direction egress`
            : ''
        }${
          publishEntries.length > 0
            ? `\nros acl bind id "${macFilterInACL}" port ${portInfo.portName} direction ingress`
            : ''
        }`;
      })
      .join('\n');

    let interSwitchDescriptions = '';
    if (!options.onlyConfigureIedPorts) {
      allNetworkVlans.forEach(vlan => vlansOnSwitch.add(vlan));

      interSwitchDescriptions = switchLinks
        .map(link => {
          if (
            link.sourceSwitch !== currentSwitch &&
            link.targetSwitch !== currentSwitch
          ) {
            return '';
          }

          const isSource = link.sourceSwitch === currentSwitch;
          const localPort = isSource ? link.sourcePort : link.targetPort;
          const remoteSwitch = isSource ? link.targetSwitch : link.sourceSwitch;
          const remotePort = isSource ? link.targetPort : link.sourcePort;
          const traffic = directionalMacBySwitchPort
            .get(currentSwitch)
            ?.get(localPort);
          const ingressEntries = Array.from(traffic?.ingress ?? [])
            .map(parseTrafficKey)
            .sort((a, b) =>
              `${a.ethType}|${a.mac}`.localeCompare(`${b.ethType}|${b.mac}`)
            );
          const egressEntries = Array.from(traffic?.egress ?? [])
            .map(parseTrafficKey)
            .sort((a, b) =>
              `${a.ethType}|${a.mac}`.localeCompare(`${b.ethType}|${b.mac}`)
            );

          if (
            options.configureSingleIedConnectivity &&
            ingressEntries.length === 0 &&
            egressEntries.length === 0
          ) {
            return '';
          }

          const allowedVlans = Array.from(allNetworkVlans).sort(
            (a, b) => a - b
          );
          const macFilterInACL = buildAclName(currentSwitch, localPort, 'in');
          const macFilterOutACL = buildAclName(currentSwitch, localPort, 'out');

          const inAclName = `ros acl set id "${macFilterInACL}" direction ingress implicit-action permit ports ${localPort} status inactive`;
          if (ingressEntries.length > 0 && !aclNames.has(inAclName)) {
            accessListsIn.push(
              buildAclConfigLines(
                macFilterInACL,
                'ingress',
                localPort,
                ingressEntries
              ).join('\n')
            );
            aclRemovalCommand.push(`ros acl delete id "${macFilterInACL}"`);
            aclNames.add(inAclName);
          }

          const outAclName = `ros acl set id "${macFilterOutACL}" direction egress implicit-action permit ports ${localPort} status inactive`;
          if (egressEntries.length > 0 && !aclNames.has(outAclName)) {
            accessListsOut.push(
              buildAclConfigLines(
                macFilterOutACL,
                'egress',
                localPort,
                egressEntries
              ).join('\n')
            );
            aclRemovalCommand.push(`ros acl delete id "${macFilterOutACL}"`);
            aclNames.add(outAclName);
          }

          return `ros interface set port ${localPort} description "${currentSwitch} uplink to ${remoteSwitch} ${remotePort}"
ros interface set port ${localPort} vlan-type trunk
ros interface set port ${localPort} pvid ${options.nativeVlan}
ros interface set port ${localPort} native-tagging untagged
ros interface set port ${localPort} vlan-allowed ${options.nativeVlan}${
            allowedVlans.length > 0 ? `,${allowedVlans.join(',')}` : ''
          }${
            ingressEntries.length > 0
              ? `\nros acl bind id "${macFilterInACL}" port ${localPort} direction ingress`
              : ''
          }${
            egressEntries.length > 0
              ? `\nros acl bind id "${macFilterOutACL}" port ${localPort} direction egress`
              : ''
          }`;
        })
        .filter(description => description !== '')
        .join('\n');
    }

    const interfaceDescriptions = [portsToConfigure, interSwitchDescriptions]
      .filter(block => block !== '')
      .join('\n');

    const scopeNote = getRuggedcomScopeNote(options);

    return [
      '#',
      `# RST2228 ROS configuration for switch ${currentSwitch}`,
      '#',
      '# Design decisions:',
      '# - VLAN mode assumed VLAN-aware with trunk/edge semantics from ROS manual.',
      '# - ACL uses implicit-action Permit with explicit deny ACEs for GOOSE/SV EtherTypes not in the allow-list.',
      '# - Cisco service-policy/spanning-tree/load-interval are omitted (no direct 1:1 mapping in this generator).',
      scopeNote,
      '# - Need to do something about vlanNames',
      accessListsIn.join('\n'),
      accessListsOut.join('\n'),
      interfaceDescriptions,
      '#',
      '# ACL rollback commands',
      '#',
      aclRemovalCommand.join('\n'),
      '#',
      'save'
    ]
      .filter(line => line !== '')
      .join('\n');
  });

  return switchConfigBlocks.join('\n\n');
}

export function buildCiscoConfigurationText(args: {
  portData: ConfigPortDataEntry[];
  switchLinks: SwitchLink[];
  iedPorts: Set<string>;
  iedTrafficIndex: Map<string, IedTraffic>;
  publishedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  subscribedTrafficByIed: Map<string, SubscribedTrafficEntry[]>;
  options: BuildSwitchConfigOptions;
}): string {
  const {
    portData,
    switchLinks,
    iedPorts,
    iedTrafficIndex,
    publishedTrafficByIed,
    subscribedTrafficByIed,
    options
  } = args;

  if (
    options.configureSingleIedConnectivity &&
    options.selectedIedName === ''
  ) {
    return '';
  }

  const scopedIeds = getScopedIeds(
    portData,
    iedPorts,
    iedTrafficIndex,
    options
  );

  const subscribedTrafficKeys = buildSubscribedTrafficKeys(
    subscribedTrafficByIed
  );

  const selectedEthernetSwitch =
    options.selectedSwitchScope !== ''
      ? options.selectedSwitchScope
      : options.allSwitchesOption;

  let switchesToConfigure: string[] = [];
  if (options.configureSingleIedConnectivity) {
    switchesToConfigure = [
      ...new Set(
        portData
          .filter(p => scopedIeds.includes(p.iedName))
          .map(p => p.switchName.trim())
          .filter(n => n !== '')
      )
    ].sort((a, b) => a.localeCompare(b));
  } else if (selectedEthernetSwitch === options.allSwitchesOption) {
    switchesToConfigure = [
      ...new Set([
        ...switchLinks.flatMap(link => [link.sourceSwitch, link.targetSwitch]),
        ...portData.map(port => port.switchName)
      ])
    ]
      .map(name => name.trim())
      .filter(name => name !== '')
      .sort((a, b) => a.localeCompare(b));
  } else {
    switchesToConfigure = [selectedEthernetSwitch];
  }

  switchesToConfigure = switchesToConfigure.filter(
    switchName =>
      selectedEthernetSwitch === options.allSwitchesOption ||
      switchName === selectedEthernetSwitch
  );

  const switchConfigBlocks = switchesToConfigure.map(currentSwitch => {
    const vlansOnSwitch: Set<number> = new Set();
    const aclConfigs: string[] = [];
    const interfaceConfigs: string[] = [];

    portData
      .filter(
        port =>
          port.switchName === currentSwitch &&
          iedPorts.has(port.iedName) &&
          (!options.configureSingleIedConnectivity ||
            scopedIeds.includes(port.iedName))
      )
      .forEach(portInfo => {
        const traffic =
          iedTrafficIndex.get(portInfo.iedName) ?? emptyIedTraffic;
        const { publishEntries, subscribeEntries } = traffic;
        const vlans = buildIedPortVlans(
          portInfo.iedName,
          publishedTrafficByIed,
          subscribedTrafficByIed,
          subscribedTrafficKeys,
          options.includeUnsubscribedMessages
        );

        vlans.forEach(vlan => vlansOnSwitch.add(vlan));

        const aclInName = `${currentSwitch.replace(
          /[^A-Za-z0-9]/g,
          '_'
        )}_${portInfo.portName.replace(/[^A-Za-z0-9]/g, '_')}_IN`;
        const aclOutName = `${currentSwitch.replace(
          /[^A-Za-z0-9]/g,
          '_'
        )}_${portInfo.portName.replace(/[^A-Za-z0-9]/g, '_')}_OUT`;

        if (publishEntries.length > 0) {
          const aclLines = [`mac access-list extended ${aclInName}`];
          publishEntries.forEach(entry => {
            aclLines.push(
              ` permit any host ${entry.mac.replace(/-/g, '.')} ${
                entry.ethType
              }`
            );
          });
          aclConfigs.push(aclLines.join('\n'));
        }

        if (subscribeEntries.length > 0) {
          const aclLines = [`mac access-list extended ${aclOutName}`];
          subscribeEntries.forEach(entry => {
            aclLines.push(
              ` permit any host ${entry.mac.replace(/-/g, '.')} ${
                entry.ethType
              }`
            );
          });
          aclConfigs.push(aclLines.join('\n'));
        }

        const ifaceLines = [
          `interface ${portInfo.portName}`,
          ` description ${currentSwitch} IED trunk to ${portInfo.iedName} ${portInfo.receivingPortName}`,
          ` switchport mode trunk`,
          ` switchport trunk native vlan ${options.nativeVlan}`,
          ` switchport trunk allowed vlan ${options.nativeVlan}${
            vlans.length > 0 ? `,${vlans.join(',')}` : ''
          }`
        ];

        if (publishEntries.length > 0) {
          ifaceLines.push(` mac access-group ${aclInName} in`);
        }
        if (subscribeEntries.length > 0) {
          ifaceLines.push(` mac access-group ${aclOutName} out`);
        }

        interfaceConfigs.push(ifaceLines.join('\n'));
      });

    if (!options.onlyConfigureIedPorts) {
      switchLinks
        .filter(
          link =>
            link.sourceSwitch === currentSwitch ||
            link.targetSwitch === currentSwitch
        )
        .forEach(link => {
          const isSource = link.sourceSwitch === currentSwitch;
          const localPort = isSource ? link.sourcePort : link.targetPort;
          const remoteSwitch = isSource ? link.targetSwitch : link.sourceSwitch;
          const remotePort = isSource ? link.targetPort : link.sourcePort;

          const allVlans = Array.from(vlansOnSwitch).sort((a, b) => a - b);

          const ifaceLines = [
            `interface ${localPort}`,
            ` description ${currentSwitch} uplink to ${remoteSwitch} ${remotePort}`,
            ` switchport mode trunk`,
            ` switchport trunk native vlan ${options.nativeVlan}`,
            ` switchport trunk allowed vlan ${options.nativeVlan}${
              allVlans.length > 0 ? `,${allVlans.join(',')}` : ''
            }`
          ];

          interfaceConfigs.push(ifaceLines.join('\n'));
        });
    }

    const scopeLabel = getCiscoScopeLabel(options);

    return [
      '!',
      `! Cisco IOS configuration for switch ${currentSwitch}`,
      '!',
      `! Active scope: ${scopeLabel}`,
      '!',
      ...aclConfigs,
      '!',
      ...interfaceConfigs,
      '!',
      'end'
    ].join('\n');
  });

  return switchConfigBlocks.join('\n\n');
}
