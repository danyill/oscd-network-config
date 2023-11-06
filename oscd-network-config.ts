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

const sampleData = ``;

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

    const iedPorts = Array.from(this.doc.querySelectorAll(':root > IED')).map(
      ied => ied.getAttribute('name')
    );

    const accessListsIn: string[] = [];
    const accessListsOut: string[] = [];

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
              `  deny any any 0x88ba 0x0`,
              `  permit   any any`,
              `!`
            ].join('\n')
          );

        if (smvMacsEgress.length > 0)
          accessListsIn.push(
            [
              `mac access-list extended ${macFilterOutACL}`,
              smvMacsEgress.map(mac => `  permit host ${mac} any`).join('\n'),
              `  deny any any 0x88ba 0x0`,
              `  permit   any any`,
              `!`
            ].join('\n')
          );

        const manufacturer =
          this.doc
            .querySelector(`:root > IED[name="${iedName}"]`)
            ?.getAttribute('manufacturer') ?? 'Unknown';
        const type =
          this.doc
            .querySelector(`:root > IED[name="${iedName}"]`)
            ?.getAttribute('type') ?? 'Unknown';

        let selSpecial = null;
        if (
          manufacturer === 'SEL' &&
          (type === 'SEL_411L_2S' || type === 'SEL_487E_5S')
        ) {
          selSpecial = `\n  speed nonegotiate`;
        }

        return `interface ${portInfo.portName}
  description ${this.substation} Protection ${this.protectionSystem} LAN ${
    this.prpNetwork
  } to ${iedName} ${portInfo.receivingPortName} 
  switchport trunk native vlan ${this.nativeVlanUI.value}
  switchport trunk allowed vlan ${this.nativeVlanUI.value}${
    vlans.length > 1 ? `,${vlans.join(',')}` : ''
  }
  switchport mode trunk
  load-interval 30${selSpecial !== null ? selSpecial : ''}
  spanning-tree portfast trunk
  service-policy input pm-dss-prot-vlan-mark-in
  service-policy output pm-dss-lan-out${
    smvMacsIngress.length > 0 ? `\n  mac access-group ${macFilterInACL} in` : ''
  }${
    smvMacsEgress.length > 0
      ? `\n  mac access-group ${macFilterOutACL} out`
      : ''
  }
!`;
      })
      .join('\n');

    this.outputUI.value = [
      interfaceDescriptions,
      accessListsIn.join('\n'),
      accessListsOut.join('\n')
    ].join('\n');
  }

  protected firstUpdated(): void {
    this.refreshInputData();

    this.addEventListener('updated-input-data-file', () => {
      this.refreshInputData();
    });
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
            this.refreshInputData();
          }}
          >Paste
          <md-icon slot="icon">content_paste</md-icon>
        </md-outlined-button>
        <md-outlined-button class="clippy" @click=${async () => {
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
        this.dispatchEvent(new CustomEvent('updated-input-data-file'));
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
