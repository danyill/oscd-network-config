import { expect } from '@open-wc/testing';

import {
  validateIedCsv,
  validateSwitchLinksCsv,
  validateCrossDatasets
} from './csvValidation.js';

describe('csvValidation', () => {
  it('flags malformed IED rows', () => {
    const result = validateIedCsv('Sw1,Port1,P1\nSw2,Port1,P2,Port5,Extra');
    expect(result.errors).to.have.length(2);
    expect(result.errors[0]).to.contain('IED data line 1');
    expect(result.errors[1]).to.contain('IED data line 2');
  });

  it('flags duplicate switch or IED ports in IED data', () => {
    const result = validateIedCsv(
      'Sw1,Port1,P1,PortA\nSw1,Port1,P2,PortB\nSw2,Port2,P1,PortA'
    );
    expect(result.errors).to.have.length(2);
    expect(result.errors[0]).to.contain('Switch port Sw1 Port1');
    expect(result.errors[1]).to.contain('IED port P1 PortA');
  });

  it('flags malformed switch link rows', () => {
    const result = validateSwitchLinksCsv(
      'Sw1,Port1,Sw2\nSw1,Port1,Sw2,Port2,Extra'
    );
    expect(result.errors).to.have.length(2);
  });

  it('flags duplicate switch ports in switch links', () => {
    const result = validateSwitchLinksCsv(
      'Sw1,Port1,Sw2,Port2\nSw1,Port1,Sw3,Port3'
    );
    expect(result.errors).to.have.length(1);
    expect(result.errors[0]).to.contain('Switch port Sw1 Port1');
  });

  it('returns no errors for valid IED CSV with no duplicates', () => {
    const result = validateIedCsv('Sw1,Port1,IED1,PortA\nSw1,Port2,IED2,PortA');
    expect(result.errors).to.have.length(0);
    expect(result.rows).to.have.length(2);
  });

  it('ignores blank lines in IED CSV', () => {
    const result = validateIedCsv(
      'Sw1,Port1,IED1,PortA\n\nSw2,Port1,IED2,PortB'
    );
    expect(result.errors).to.have.length(0);
    expect(result.rows).to.have.length(2);
  });

  it('returns no errors for valid switch links CSV with no duplicates', () => {
    const result = validateSwitchLinksCsv(
      'Sw1,Port1,Sw2,Port2\nSw2,Port3,Sw3,Port3'
    );
    expect(result.errors).to.have.length(0);
    expect(result.rows).to.have.length(2);
  });
});

describe('validateCrossDatasets', () => {
  it('returns no errors when IED and switch link ports are disjoint', () => {
    const iedRows = [
      {
        switchName: 'Sw1',
        portName: 'Port1',
        iedName: 'IED1',
        receivingPortName: 'PortA'
      }
    ];
    const switchLinkRows = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'Port2',
        targetSwitch: 'Sw2',
        targetPort: 'Port1'
      }
    ];
    expect(validateCrossDatasets(iedRows, switchLinkRows)).to.have.length(0);
  });

  it('flags a source port that conflicts with an IED port', () => {
    const iedRows = [
      {
        switchName: 'Sw1',
        portName: 'Port1',
        iedName: 'IED1',
        receivingPortName: 'PortA'
      }
    ];
    const switchLinkRows = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'Port1',
        targetSwitch: 'Sw2',
        targetPort: 'Port2'
      }
    ];
    const errors = validateCrossDatasets(iedRows, switchLinkRows);
    expect(errors).to.have.length(1);
    expect(errors[0]).to.contain('Sw1 Port1');
    expect(errors[0]).to.contain('both IED and Switch Link');
  });

  it('flags a target port that conflicts with an IED port', () => {
    const iedRows = [
      {
        switchName: 'Sw2',
        portName: 'Port2',
        iedName: 'IED1',
        receivingPortName: 'PortA'
      }
    ];
    const switchLinkRows = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'Port1',
        targetSwitch: 'Sw2',
        targetPort: 'Port2'
      }
    ];
    const errors = validateCrossDatasets(iedRows, switchLinkRows);
    expect(errors).to.have.length(1);
    expect(errors[0]).to.contain('Sw2 Port2');
  });

  it('flags both source and target when both conflict', () => {
    const iedRows = [
      {
        switchName: 'Sw1',
        portName: 'Port1',
        iedName: 'IED1',
        receivingPortName: 'PortA'
      },
      {
        switchName: 'Sw2',
        portName: 'Port2',
        iedName: 'IED2',
        receivingPortName: 'PortB'
      }
    ];
    const switchLinkRows = [
      {
        sourceSwitch: 'Sw1',
        sourcePort: 'Port1',
        targetSwitch: 'Sw2',
        targetPort: 'Port2'
      }
    ];
    const errors = validateCrossDatasets(iedRows, switchLinkRows);
    expect(errors).to.have.length(2);
  });

  it('returns no errors for empty inputs', () => {
    expect(validateCrossDatasets([], [])).to.have.length(0);
  });

  it('ignores IED rows with empty switchName or portName', () => {
    // Rows with empty switchName/portName should not be collected as IED ports
    const iedRows = [
      {
        switchName: '',
        portName: 'Port1',
        iedName: 'IED1',
        receivingPortName: 'PortA'
      }
    ];
    const switchLinkRows = [
      {
        sourceSwitch: '',
        sourcePort: 'Port1',
        targetSwitch: 'Sw2',
        targetPort: 'Port2'
      }
    ];
    expect(validateCrossDatasets(iedRows, switchLinkRows)).to.have.length(0);
  });
});
