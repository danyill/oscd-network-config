import { expect } from '@open-wc/testing';

import {
  TPNS,
  XSINS,
  createSubscribedAddress
} from './createSubscribedAddress.js';
import { createSubscribedAddressDoc } from './createSubscribedAddress.testfiles.js';

const testDoc = new DOMParser().parseFromString(
  createSubscribedAddressDoc,
  'application/xml'
);

describe('Function to return a new Private mirroring the communication address', () => {
  it('returns a Private for a GSE', () => {
    const gseComm = testDoc.querySelector(
      'ConnectedAP[iedName="GOOSE_Publisher"] GSE[cbName="GOOSE2"]'
    )!;
    expect(gseComm).to.not.equal(null);

    const privateSub = createSubscribedAddress(gseComm);

    expect(privateSub?.tagName).to.equal('Private');
    expect(privateSub?.firstElementChild?.tagName).to.equal('Address');
    expect(privateSub?.getAttribute('type')).to.equal(
      'Transpower-GSE-Subscribe'
    );

    expect(privateSub!.getAttributeNS(TPNS, 'iedName')).to.equal(
      'GOOSE_Publisher'
    );
    expect(privateSub!.getAttributeNS(TPNS, 'cbName')).to.equal('GOOSE2');
    expect(privateSub!.getAttributeNS(TPNS, 'ldInst')).to.equal(
      'QB2_Disconnector'
    );

    const address = privateSub?.querySelector('Address');
    expect(address!.namespaceURI).to.equal(TPNS);
    expect(address?.childElementCount).to.equal(3);

    const mac = address?.querySelector('P[type="MAC-Address"]');
    expect(mac!.namespaceURI).to.equal(TPNS);
    expect(mac!.getAttributeNS(XSINS, 'type')).to.equal('tP_MAC-Address');
    expect(mac!.textContent).to.equal('01-0C-CD-01-01-01');

    const id = address?.querySelector('P[type="VLAN-ID"]');
    expect(id!.namespaceURI).to.equal(TPNS);
    expect(id!.getAttributeNS(XSINS, 'type')).to.equal('tP_VLAN-ID');
    expect(id!.textContent).to.equal('3EE');

    const priority = address?.querySelector('P[type="VLAN-PRIORITY"]');
    expect(priority!.namespaceURI).to.equal(TPNS);
    expect(priority!.getAttributeNS(XSINS, 'type')).to.equal(
      'tP_VLAN-PRIORITY'
    );
    expect(priority!.textContent).to.equal('4');
  });

  it('returns a Private for a SMV', () => {
    const smvComm = testDoc.querySelector(
      'ConnectedAP[iedName="SMV_Publisher"][apName="PP1"] SMV[cbName="currrentOnlyDifferentAp"]'
    )!;
    expect(smvComm).to.not.equal(null);

    const privateSub = createSubscribedAddress(smvComm);

    expect(privateSub?.tagName).to.equal('Private');
    expect(privateSub?.firstElementChild?.tagName).to.equal('Address');
    expect(privateSub?.getAttribute('type')).to.equal(
      'Transpower-SMV-Subscribe'
    );

    expect(privateSub!.getAttributeNS(TPNS, 'iedName')).to.equal(
      'SMV_Publisher'
    );
    expect(privateSub!.getAttributeNS(TPNS, 'cbName')).to.equal(
      'currrentOnlyDifferentAp'
    );
    expect(privateSub!.getAttributeNS(TPNS, 'ldInst')).to.equal(
      'CurrentTransformer'
    );

    const address = privateSub?.querySelector('Address');
    expect(address!.namespaceURI).to.equal(TPNS);
    expect(address?.childElementCount).to.equal(3);

    const mac = address?.querySelector('P[type="MAC-Address"]');
    expect(mac!.namespaceURI).to.equal(TPNS);
    expect(mac!.getAttributeNS(XSINS, 'type')).to.equal('tP_MAC-Address');
    expect(mac!.textContent).to.equal('01-0C-CD-04-00-02');

    const id = address?.querySelector('P[type="VLAN-ID"]');
    expect(id!.namespaceURI).to.equal(TPNS);
    expect(id!.getAttributeNS(XSINS, 'type')).to.equal('tP_VLAN-ID');
    expect(id!.textContent).to.equal('3EE');

    const priority = address?.querySelector('P[type="VLAN-PRIORITY"]');
    expect(priority!.namespaceURI).to.equal(TPNS);
    expect(priority!.getAttributeNS(XSINS, 'type')).to.equal(
      'tP_VLAN-PRIORITY'
    );
    expect(priority!.textContent).to.equal('4');
  });

  it('returns null if no MAC/VLAN ID/VLAN Priority', () => {
    const smvComm = testDoc.querySelector(
      'ConnectedAP[iedName="SMV_Publisher"][apName="AP1"] SMV[cbName="fullSmv"]'
    )!;
    expect(smvComm).to.not.equal(null);

    const privateSub = createSubscribedAddress(smvComm);
    expect(privateSub).to.equal(null);
  });
});
