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
XAT111,GigabitEthernet1/0/1,XAT_BusA_P2
XAT111,GigabitEthernet1/0/2,XAT_C3_P2
XAT111,GigabitEthernet1/0/3,XAT_T1_P2
XAT111,GigabitEthernet1/0/4,XAT_220_M2
XAT111,GigabitEthernet1/0/5,XAT_232_M2
XAT111,GigabitEthernet1/0/6,XAT_242_M2
XAT111,GigabitEthernet1/0/7,XAT_252_M2
XAT111,GigabitEthernet1/0/8,XAT_2202_M2
XAT111,GigabitEthernet1/0/9,XAT_C3_M2
XAT111,GigabitEthernet1/0/10,XAT_T1_M2
XAT111,GigabitEthernet1/0/11,XAT_278_M2
XAT111,GigabitEthernet1/0/12,XAT_232_P2
XAT111,GigabitEthernet1/0/13,SOM_102_M2
XAT111,GigabitEthernet1/0/14,SOM_102_P2
XAT111,GigabitEthernet1/0/15,XAT_T1_M4
XAT111,GigabitEthernet1/0/16,XAT_350_M2
XAT111,GigabitEthernet1/0/17,XAT_288_M2
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
  portData: { switchName: string; portName: string; iedName: string }[] | null =
    null;

  @property({ attribute: false })
  switchNames: string[] = [];

  @query('#input')
  inputUI!: TextField;

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
        switchName: fields[0],
        portName: fields[1],
        iedName: fields[2]
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
    this.protectionSystem = <'1' | '2'>selectedEthernetSwitch.slice(3, 4);
    this.prpNetwork =
      parseInt(selectedEthernetSwitch.slice(5, 6), 10) % 2 === 1 ? 'A' : 'B';

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
  }

  protected firstUpdated(): void {
    this.refreshInputData();
  }

  render(): TemplateResult {
    return html`<section>
        <h1>
          Network Configuration Generation for Cisco IE-9320 Ethernet Switches
        </h1>
        <h2>Data Center Infrastructure Management Data</h2>
        <md-outlined-text-field
          id="input"
          type="textarea"
          label="Input CSV data in the form: Switch Name, Port Name, IED Name"
          value="${sampleData}"
          rows="100"
          @input=${() => {
            this.refreshInputData();
          }}
        >
        </md-outlined-text-field>
        <md-outlined-button class="clippy"
          >Paste
          <md-icon slot="icon">content_paste</md-icon>
        </md-outlined-button>
        <md-outlined-button class="clippy"
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
        >
        </md-outlined-text-field>
        <md-outlined-button class="clippy"
          >Copy
          <md-icon slot="icon">content_copy</md-icon>
        </md-outlined-button>
        <md-outlined-button class="clippy"
          >Download
          <md-icon slot="icon">download</md-icon>
        </md-outlined-button>
      </section>`;
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

    md-outlined-text-field {
      resize: vertical;
    }
  `;
}
