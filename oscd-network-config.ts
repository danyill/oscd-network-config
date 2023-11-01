import { LitElement, TemplateResult, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';

import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/filled-select.js';
import '@material/web/select/select-option.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';
import { TextField } from '@material/web/textfield/internal/text-field';

// XAT111 = PRP A
// XAT112 = PRP B

// Prot 1
// PRP          A                 B
// Tier 1 = 101                 102
// Tier 2 = 111 / 113           112 / 114
// Tier 3 = 131 / 133 / 135     132 / 134 / 135

// Prot 2
// PRP          A                 B
// Tier 1 = 201                 202
// Tier 2 = 211 / 213           212 / 214
// Tier 3 = 231 / 233 / 235     232 / 234 / 235

type portData = {
  type: string;
  manufacturer: string;
  configVersion: string;
  ports: {
    SV: {
      A: string;
      B: string;
    };
    GOOSE: {
      A: string;
      B: string;
    };
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const relayPortInformation: portData[] = [
  {
    type: 'B30',
    manufacturer: 'GE Multilin',
    configVersion: '8.30',
    ports: {
      SV: {
        A: '1A',
        B: '1B'
      },
      GOOSE: {
        A: '2',
        B: '3'
      }
    }
  },
  {
    type: 'SEL_487E_5S',
    manufacturer: 'SEL',
    configVersion: 'ICD-487E-5S-R003-V0-Z402006-D20211217',
    ports: {
      SV: {
        A: '5A',
        B: '5B'
      },
      GOOSE: {
        A: '5A',
        B: '5B'
      }
    }
  },
  {
    type: 'SEL_411L_2S',
    manufacturer: 'SEL',
    configVersion: 'ICD-411L-2S-R001-V0-Z200006-D20210701',
    ports: {
      SV: {
        A: '5A',
        B: '5B'
      },
      GOOSE: {
        A: '5A',
        B: '5B'
      }
    }
  },
  {
    type: 'SEL_2414',
    manufacturer: 'SEL',
    configVersion: 'ICD-2414-R109-V0-Z000000-D20210409',
    ports: {
      SV: {
        A: 'Unavailable',
        B: 'Unavailable'
      },
      GOOSE: {
        A: '1A',
        B: '1B'
      }
    }
  },
  {
    type: 'PCS-221S',
    manufacturer: 'NRR',
    configVersion: '1.00',
    ports: {
      SV: {
        A: '1',
        B: '2'
      },
      GOOSE: {
        A: '1',
        B: '2'
      }
    }
  },
  {
    type: '7SS85',
    manufacturer: 'SIEMENS',
    configVersion: 'V09.20.01',
    ports: {
      SV: {
        A: 'F:CH1',
        B: 'F:CH2'
      },
      GOOSE: {
        A: 'F:CH1',
        B: 'F:CH2'
      }
    }
  },
  {
    type: '7SJ85',
    manufacturer: 'SIEMENS',
    configVersion: 'V09.20.01',
    ports: {
      SV: {
        A: 'F:CH1',
        B: 'F:CH2'
      },
      GOOSE: {
        A: 'F:CH1',
        B: 'F:CH2'
      }
    }
  },
  {
    type: '7UT85',
    manufacturer: 'SIEMENS',
    configVersion: 'V09.20.01',
    ports: {
      SV: {
        A: 'F:CH1',
        B: 'F:CH2'
      },
      GOOSE: {
        A: 'F:CH1',
        B: 'F:CH2'
      }
    }
  },
  {
    type: '6MU85',
    manufacturer: 'SIEMENS',
    configVersion: 'V09.20.01',
    ports: {
      SV: {
        A: 'F:CH1',
        B: 'F:CH2'
      },
      GOOSE: {
        A: 'F:CH1',
        B: 'F:CH2'
      }
    }
  },
  {
    type: '7SL86',
    manufacturer: 'SIEMENS',
    configVersion: 'V09.20.01',
    ports: {
      SV: {
        A: 'F:CH1',
        B: 'F:CH2'
      },
      GOOSE: {
        A: 'F:CH1',
        B: 'F:CH2'
      }
    }
  }
];

// Add: SEL-2440, SEL-751, P746 ??
// Update versions

const sampleData = `
   
XATSWA051, GigabitEthernet1/0/1, XAT_P1_SMS01_SG4260_9002794, ENET1   
XATSWA051, GigabitEthernet1/0/2, XAT_P2_SMS01_SG4260_9003816, ENET-1       
XATSWA051, GigabitEthernet1/0/5, XATHMI001, LAN1   
XATSWA051, GigabitEthernet1/0/6, KF832E, ETH1   
XATSWA051, GigabitEthernet1/0/7, PF461Y, ETH1   
XATSWA051, GigabitEthernet1/0/8, FK681L, ETH1   
XATSWA051, GigabitEthernet1/0/9, BN278M, A   
XATSWA051, GigabitEthernet1/0/10, FN652C, ETH1   
XATSWA051, GigabitEthernet1/0/11, TEST_2, Front   
XATSWA051, GigabitEthernet1/0/12, XAT_Temp_C1, Ethernet   
XATSWA051, GigabitEthernet1/0/13, XATSWA101, GigabitEthernet1/0/24   
XATSWA051, GigabitEthernet1/0/14, XATSWA102, GigabitEthernet1/0/28   
XATSWA051, GigabitEthernet1/0/15, XATSWA052, GigabitEthernet1/0/15         
XATSWA051, GigabitEthernet1/0/19, XAT-DSSSVR02, 10gePCIe3-1   
XATSWA051, GigabitEthernet1/0/20, XATSWA111, GigabitEthernet1/0/24     
XATSWA051, GigabitEthernet1/0/22, XATSWA112, GigabitEthernet1/0/24   
XATSWA051, GigabitEthernet1/0/23, AC PDU, ETH   
XATSWA051, GigabitEthernet1/0/24, XAT_TSYN_BusA_1, ETHF       
XATSWA051, GigabitEthernet1/0/27, XATSWA052, GigabitEthernet1/0/27        
XATSWA052, GigabitEthernet1/0/1, XAT_P1_SMS01_SG4260_9002794, ENET2   
XATSWA052, GigabitEthernet1/0/2, XAT_P2_SMS01_SG4260_9003816, ENET-2       
XATSWA052, GigabitEthernet1/0/5, XATHMI001, LAN2   
XATSWA052, GigabitEthernet1/0/6, KF832E, ETH2   
XATSWA052, GigabitEthernet1/0/7, PF461Y, ETH2   
XATSWA052, GigabitEthernet1/0/8, FK681L, ETH2   
XATSWA052, GigabitEthernet1/0/9, BN278M, B   
XATSWA052, GigabitEthernet1/0/10, FN652C, ETH2   
XATSWA052, GigabitEthernet1/0/11, DSS_LAB_Desk_Sw_1, GigabitEthernet0/1     
XATSWA052, GigabitEthernet1/0/13, XATSWA211, GigabitEthernet1/0/28   
XATSWA052, GigabitEthernet1/0/14, XATSWA212, GigabitEthernet1/0/28   
XATSWA052, GigabitEthernet1/0/15, XATSWA051, GigabitEthernet1/0/15     
XATSWA052, GigabitEthernet1/0/17, XAT-DSSLAP03, Toshiba KB Dock     
XATSWA052, GigabitEthernet1/0/19, XAT-DSSSVR02, 10gePCIe6-1   
XATSWA052, GigabitEthernet1/0/20, HAYSWA010, GigabitEthernet1/0/24   
XATSWA052, GigabitEthernet1/0/21, XATSWA211, GigabitEthernet1/0/24   
XATSWA052, GigabitEthernet1/0/22, XATSWA212, GigabitEthernet1/0/24   
XATSWA052, GigabitEthernet1/0/23, XAT_TSYN_BusA_2, Admin   
XATSWA052, GigabitEthernet1/0/24, BN278M, ETH   
XATSWA052, GigabitEthernet1/0/25, XATSWA302, GigabitEthernet0/2     
XATSWA052, GigabitEthernet1/0/27, XATSWA051, GigabitEthernet1/0/27   
XATSWA052, GigabitEthernet1/0/28, XATSWO013, GigabitEthernet1/0/52      
XATSWA101, GigabitEthernet1/0/1, XATSWA111, GigabitEthernet1/0/28                     
XATSWA101, GigabitEthernet1/0/11, XAT_RTAC_2, ETH1     
XATSWA101, GigabitEthernet1/0/13, DSSPOCEWS01, Prot1:PORT-0           
XATSWA101, GigabitEthernet1/0/18, XAT_P1_SMS01_SG4260_9002794, C-ENET1     
XATSWA101, GigabitEthernet1/0/20, XAT_P2_SMS01_SG4260_9003816, ENET-C1         
XATSWA101, GigabitEthernet1/0/24, XATSWA051, GigabitEthernet1/0/13                                  
XATSWA102, GigabitEthernet1/0/11, XAT_RTAC_2, ETH2   
XATSWA102, GigabitEthernet1/0/12, XAT_RTAC_2, ETH3   
XATSWA102, GigabitEthernet1/0/13, DSSPOCEWS01, Prot1:PORT-1           
XATSWA102, GigabitEthernet1/0/18, XAT_P1_SMS01_SG4260_9002794, C-ENET2     
XATSWA102, GigabitEthernet1/0/20, XAT_P2_SMS01_SG4260_9003816, ENET-C2                 
XATSWA102, GigabitEthernet1/0/28, XATSWA051, GigabitEthernet1/0/14      
XATSWA111, GigabitEthernet1/0/1, XAT_BusA_P1, a1   
XATSWA111, GigabitEthernet1/0/2, XAT_232_P1, 1GB_PORT5A   
XATSWA111, GigabitEthernet1/0/3, SOM_112_P1, 1GB_PORT5A   
XATSWA111, GigabitEthernet1/0/4, XAT_T1_P1, 1GB_PROT5A   
XATSWA111, GigabitEthernet1/0/5, XAT_242_M1 (ODJB), Port1   
XATSWA111, GigabitEthernet1/0/6, XAT_T1_M3, PORT1A   
XATSWA111, GigabitEthernet1/0/7, TEST, Port1   
XATSWA111, GigabitEthernet1/0/8, XAT_242_M3, 1A   
XATSWA111, GigabitEthernet1/0/9, XAT_BusA_P1, PRT2   
XATSWA111, GigabitEthernet1/0/10, TEST_2, Port1   
XATSWA111, GigabitEthernet1/0/11, XAT_242_C1, 1A                     
XATSWA111, GigabitEthernet1/0/21, XAT_TSYN_BusA_1, ETH1   
XATSWA111, GigabitEthernet1/0/22, XAT_TSYN_BusA_2, ETH3     
XATSWA111, GigabitEthernet1/0/24, XATSWA051, GigabitEthernet1/0/20         
XATSWA111, GigabitEthernet1/0/28, XATSWA101, GigabitEthernet1/0/1      
XATSWA112, GigabitEthernet1/0/1, XAT_BusA_P1, b1   
XATSWA112, GigabitEthernet1/0/2, XAT_232_P1, 1GB_PORT5B   
XATSWA112, GigabitEthernet1/0/3, SOM_112_P1, 1GB_PORT5B   
XATSWA112, GigabitEthernet1/0/4, XAT_T1_P1, 1GB_PROT5B   
XATSWA112, GigabitEthernet1/0/5, XAT_242_M1 (ODJB), Port2   
XATSWA112, GigabitEthernet1/0/6, XAT_T1_M3, PORT1B   
XATSWA112, GigabitEthernet1/0/7, TEST, Port2   
XATSWA112, GigabitEthernet1/0/8, XAT_242_M3, 1B   
XATSWA112, GigabitEthernet1/0/9, XAT_BusA_P1, PRT3   
XATSWA112, GigabitEthernet1/0/10, TEST_2, Port2   
XATSWA112, GigabitEthernet1/0/11, XAT_242_C1, 1B           
XATSWA112, GigabitEthernet1/0/16, XAT_TSYN_BusA_3, ETH1       
XATSWA112, GigabitEthernet1/0/19, XAT_TSYN_BusA_3, ETH3     
XATSWA112, GigabitEthernet1/0/21, XAT_TSYN_BusA_1, ETH2   
XATSWA112, GigabitEthernet1/0/22, XAT_TSYN_BusA_2, ETH4     
XATSWA112, GigabitEthernet1/0/24, XATSWA051, GigabitEthernet1/0/22              
XATSWA211, GigabitEthernet1/0/1, XAT_BusA_P2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/2, XAT_232_P2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/3, SOM_112_P2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/4, XAT_T1_P2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/5, XAT_C3_P2, E:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/6, XAT_T1_M4, PORT1A   
XATSWA211, GigabitEthernet1/0/7, XAT_278_M2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/8, XAT_2202_M2, F:ETH-BD-2FO:CH1   
XATSWA211, GigabitEthernet1/0/9, XAT_P1_SMS01_SG4260_9002794, C-ENET3   
XATSWA211, GigabitEthernet1/0/10, XAT_242_M2, PortF_ETH-BD-2FO_CH1   
XATSWA211, GigabitEthernet1/0/11, DSSPOCEWS01, Prot2:PORT-0               
XATSWA211, GigabitEthernet1/0/18, XAT_RTAC_2, ETH4       
XATSWA211, GigabitEthernet1/0/21, XAT_TSYN_BusA_1, ETH3   
XATSWA211, GigabitEthernet1/0/22, XAT_TSYN_BusA_2, ETH5     
XATSWA211, GigabitEthernet1/0/24, XATSWA052, GigabitEthernet1/0/21   
XATSWA211, GigabitEthernet1/0/25, XAT_P1_SMS01_SG4260_9002794, D-ENET1   
XATSWA211, GigabitEthernet1/0/26, XAT_P2_SMS01_SG4260_9003816, ENET-C3     
XATSWA211, GigabitEthernet1/0/28, XATSWA052, GigabitEthernet1/0/13      
XATSWA212, GigabitEthernet1/0/1, XAT_BusA_P2, F:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/2, XAT_232_P2, F:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/3, SOM_112_P2, F:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/4, XAT_T1_P2, F:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/5, XAT_C3_P2, E:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/6, XAT_T1_M4, PORT1B   
XATSWA212, GigabitEthernet1/0/7, XAT_278_M2, F:ETH-BD-2FO:CH2   
XATSWA212, GigabitEthernet1/0/8, XAT_2202_M2, F:ETH-BD-2FO:CH2     
XATSWA212, GigabitEthernet1/0/10, XAT_242_M2, PortF_ETH-BD-2FO_CH2   
XATSWA212, GigabitEthernet1/0/11, DSSPOCEWS01, Prot2:PORT-1                     
XATSWA212, GigabitEthernet1/0/21, XAT_TSYN_BusA_1, ETH4   
XATSWA212, GigabitEthernet1/0/22, XAT_TSYN_BusA_2, ETH6     
XATSWA212, GigabitEthernet1/0/24, XATSWA052, GigabitEthernet1/0/22   
XATSWA212, GigabitEthernet1/0/25, XAT_P1_SMS01_SG4260_9002794, D-ENET2   
XATSWA212, GigabitEthernet1/0/26, XAT_P2_SMS01_SG4260_9003816, ENET-C4     
XATSWA212, GigabitEthernet1/0/28, XATSWA052, GigabitEthernet1/0/14   
`;

/**
 * A plugin which supplements data in the Communication section
 * to show subscribing data for GSE and SMV addresses.
 */
export default class NetworkConfig extends LitElement {
  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  @property({ attribute: false })
  docName!: string;

  @property({ attribute: false })
  prpNetwork: 'A' | 'B' = 'A';

  @property({ attribute: false })
  protectionSystem: '1' | '2' = '1';

  @property({ attribute: false })
  nativeVlan: string = '101';

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

  @query('#input')
  inputUI!: TextField;

  @query('#csv-input')
  importCsvUI!: HTMLInputElement;

  @query('#output')
  outputUI!: TextField;

  @query('#ethernetSwitch')
  ethernetSwitchUI!: TextField;

  @query('#nativeVlan')
  nativeVlanUI!: TextField;

  refreshInputData() {
    const lines = this.inputUI.value.trim().split('\n');
    this.portData = lines.map(line => {
      const fields = line.split(',');
      return {
        switchName: fields[0]?.trim(),
        portName: fields[1]?.trim(),
        iedName: fields[2]?.trim(),
        receivingPortName: fields[3]?.trim()
      };
    });

    this.switchNames = [...new Set(this.portData.map(pd => pd.switchName))];
  }

  buildOutputConfiguration() {
    if (
      !this.portData ||
      !this.ethernetSwitchUI ||
      !this.ethernetSwitchUI.value
    )
      return;
    const selectedEthernetSwitch = this.ethernetSwitchUI.value;

    const portsToConfigure = this.portData.filter(
      port => port.switchName === selectedEthernetSwitch
    );

    this.substation = selectedEthernetSwitch.slice(0, 3);
    this.protectionSystem =
      <'1' | '2'>selectedEthernetSwitch.slice(6, 7) === '1' ? '1' : '2';
    this.prpNetwork =
      parseInt(selectedEthernetSwitch.slice(8, 9), 10) % 2 === 1 ? 'A' : 'B';

    console.log(
      'Ports',
      portsToConfigure,
      'Substation',
      this.substation,
      'Protection System',
      this.protectionSystem,
      'PRP Network',
      this.prpNetwork,
      'Native VLAN',
      this.nativeVlanUI.value
    );
    console.log('hi');

    const iedPorts = Array.from(this.doc.querySelectorAll(':root > IED')).map(
      ied => ied.getAttribute('name')
    );

    const accessListsIn: string[] = [];
    const accessListsOut: string[] = [];

    console.log(iedPorts);

    const interfaceDescriptions = portsToConfigure
      .filter(portInfo => iedPorts.includes(portInfo.iedName))
      .map(portInfo => {
        const { iedName } = portInfo;

        const gsePublish = Array.from(
          this.doc.querySelectorAll(
            `:root > Communication > SubNetwork > ConnectedAP[iedName="${iedName}"] > GSE`
          )
        );
        const smvPublish = Array.from(
          this.doc.querySelectorAll(
            `:root > Communication > SubNetwork > ConnectedAP[iedName="${iedName}"] > SMV`
          )
        );
        const gseSubscribe = Array.from(
          this.doc.querySelectorAll(
            `:root > Communication > SubNetwork > ConnectedAP[iedName="${iedName}"] > Private[type="Transpower-GSE-Subscribe"]`
          )
        );
        const smvSubscribe = Array.from(
          this.doc.querySelectorAll(
            `:root > Communication > SubNetwork > ConnectedAP[iedName="${iedName}"] > Private[type="Transpower-SMV-Subscribe"]`
          )
        );

        const vlans = [
          ...new Set(
            [
              ...gsePublish,
              ...smvPublish,
              ...gseSubscribe,
              ...smvSubscribe
            ].map(gseOrSmv =>
              parseInt(
                gseOrSmv.querySelector('Address > P[type="VLAN-ID"]')
                  ?.textContent ?? '0',
                16
              )
            )
          )
        ]
          .filter(vlan => vlan !== 0)
          .sort();

        const smvMacsIngress = smvPublish
          .map(
            smv =>
              smv
                .querySelector('Address > P[type="MAC-Address"]')
                ?.textContent?.trim() ?? ''
          )
          .filter(smv => smv !== '');
        const smvMacsEgress = smvSubscribe
          .map(
            smv =>
              smv
                .querySelector('Address > P[type="MAC-Address"]')
                ?.textContent?.trim() ?? ''
          )
          .filter(smv => smv !== '');

        const macFilterInACL = `al-${portInfo.portName.replace(/ \//, '')}-in`;
        const macFilterOutACL = `al-${portInfo.portName.replace(
          / \//,
          ''
        )}-out`;

        if (smvMacsIngress.length > 0)
          accessListsIn.push(
            [
              `mac access-list extended ${macFilterInACL}`,
              smvMacsIngress.map(mac => `  permit host ${mac} any`).join('\n'),
              `  deny   any any`,
              `!`
            ].join('\n')
          );

        if (smvMacsEgress.length > 0)
          accessListsIn.push(
            [
              `mac access-list extended ${macFilterOutACL}`,
              smvMacsEgress.map(mac => `  permit host ${mac} any`).join('\n'),
              `  deny   any any`,
              `!`
            ].join('\n')
          );

        return `interface ${portInfo.portName}
  description ${this.substation} Protection ${this.protectionSystem} LAN ${
    this.prpNetwork
  } to ${iedName} ${portInfo.receivingPortName} 
  switchport trunk native vlan ${this.nativeVlanUI.value}
  switchport trunk allowed vlan ${this.nativeVlanUI.value}${
    vlans.length > 1 ? `,${vlans.join(',')}` : ''
  }
  switchport mode trunk
  load-interval 30
  spanning-tree portfast trunk
  service-policy input pm-dss-prot-vlan-mark-in
  service-policy output pm-dss-lan-out${
    smvMacsIngress.length > 0 ? `\n  mac access-group ${macFilterInACL}` : ''
  }${smvMacsEgress.length > 0 ? `\n  mac access-group ${macFilterOutACL}` : ''}
!`;
      })
      .join('\n');

    console.log(interfaceDescriptions);
    this.outputUI.value = [
      interfaceDescriptions,
      accessListsIn.join('\n'),
      accessListsOut.join('\n')
    ].join('\n');
  }

  protected firstUpdated(): void {
    this.refreshInputData();
  }

  // eslint-disable-next-line class-methods-use-this
  importData(): void {}

  render(): TemplateResult {
    return html`<section>
        <h1>
          Network Configuration Generation for Cisco IE-9320 Ethernet Switches
        </h1>
        <h2>Data Center Infrastructure Management Data</h2>
        <md-outlined-text-field
          id="input"
          type="textarea"
          label="Input CSV data in the form: Switch Name, Port Name, IED Name, Receiving Port Name"
          value="${sampleData}"
          rows="100"
          spellcheck="false"
          @input=${() => {
            this.refreshInputData();
          }}
        >
        </md-outlined-text-field>
        <md-outlined-button
          class="clippy"
          @click=${() => {
            navigator.clipboard.readText().then(
              // eslint-disable-next-line no-return-assign
              pasteText => (this.inputUI.value = pasteText)
            );
          }}
          >Paste
          <md-icon slot="icon">content_paste</md-icon>
        </md-outlined-button>
        <md-outlined-button class="clippy" @click=${() => {
          this.importCsvUI.click();
          this.refreshInputData();
        }}
          >Import
          <md-icon slot="icon">attach_file</md-icon>
        </md-outlined-button>
      </section>
      <section>
        <h2>Configuration Data</h2>
        <div id="selection">
          <md-filled-select
            class="selection-item"
            id="ethernetSwitch"
            label="Select Ethernet Switch"
            required
          >
            ${this.switchNames.map(
              switchName =>
                html`<md-select-option value="${switchName}">
                  <div slot="headline">${switchName}</div>
                </md-select-option>`
            )}
          </md-filled-select>
          <md-outlined-text-field
            class="selection-item"
            id="nativeVlan"
            label="Native VLAN (decimal)"
            value="1000"
            maxlength="5"
          >
          </md-outlined-text-field>
          <md-filled-button
            class="selection-item"
            @click=${() => {
              if (!this.doc) return;
              this.buildOutputConfiguration();
            }}
            >Build Configuration
            <md-icon slot="icon">build</md-icon>
          </md-filled-button>
        </div>
        <md-outlined-text-field
          id="output"
          type="textarea"
          label="Output switch configuration"
          rows="5000"
          spellcheck="false"
        >
        </md-outlined-text-field>
        <md-outlined-button
          class="clippy"
          @click=${() => {
            navigator.permissions
              .query({ name: 'clipboard-write' as any })
              .then(result => {
                if (result.state === 'granted' || result.state === 'prompt') {
                  navigator.clipboard.writeText(this.outputUI?.value ?? '');
                }
              });
          }}
          >Copy
          <md-icon slot="icon">content_copy</md-icon>
        </md-outlined-button>
        <md-outlined-button
          class="clippy"
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
      </section>
      
      <input @click=${
        // eslint-disable-next-line no-return-assign
        (event: MouseEvent) =>
          // eslint-disable-next-line no-param-reassign
          ((<HTMLInputElement>event.target).value = '')
      } @change=${async (event: Event) => {
        const file =
          (<HTMLInputElement | null>event.target)?.files?.item(0) ?? false;
        if (!file) return;

        this.inputUI.value = await file.text();
      }} id="csv-input" accept=".csv,.txt" type="file"></input>
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
      padding: 5px;
    }

    #input,
    #output {
      width: 80%;
      max-height: 300px;
      padding: 5px;
      font-weight: bolder;
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

    .clippy {
      position: relative;
      top: 4px;
    }

    input {
      width: 0;
      height: 0;
      opacity: 0;
    }

    md-outlined-text-field {
      resize: vertical;
    }
  `;
}
