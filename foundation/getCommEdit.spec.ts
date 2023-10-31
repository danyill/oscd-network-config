import { expect } from '@open-wc/testing';

import { getCommEdit } from './getCommEdit.js';
import { getCommEditDoc } from './getCommEdit.testfiles.js';
import { createSubscribedAddress } from './createSubscribedAddress.js';

const testDoc = new DOMParser().parseFromString(
  getCommEditDoc,
  'application/xml'
);

describe('Function to add to Communications section a GSE or SMV Subscribe element', () => {
  it('creates a ConnectedAP as required ', () => {
    const addr = testDoc.querySelector('GSE[cbName="GOOSE2"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'GOOSE_Subscriber');

    expect(commEdit!.node.nodeName).to.equal('ConnectedAP');
  });

  it('creates only the Private if ConnectedAP exists', () => {
    const addr = testDoc.querySelector('SMV[cbName="fullSmv"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'SMV_Subscriber');

    expect(commEdit!.node.nodeName).to.equal('Private');
  });

  it('creates nothing if no SubNetwork exists provided', () => {
    const addr = testDoc.querySelector('SMV[cbName="fullSmv"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'SMV_Subscriber');

    expect(commEdit!.node.nodeName).to.equal('Private');
  });
});
