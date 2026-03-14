import { expect } from '@open-wc/testing';

import { crossProduct, getCommEdit } from './getCommEdit.js';
import { getCommEditDoc } from './getCommEdit.testfiles.js';
import { createSubscribedAddress } from './createSubscribedAddress.js';

describe('Function to add to Communications section a GSE or SMV Subscribe element', () => {
  it('creates a new ConnectedAP under the same SubNetwork when one does not exist', () => {
    const testDoc = new DOMParser().parseFromString(
      getCommEditDoc,
      'application/xml'
    );
    const addr = testDoc.querySelector('GSE[cbName="GOOSE2"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'GOOSE_Subscriber');

    expect(commEdit!.node.nodeName).to.equal('ConnectedAP');
    expect((commEdit!.node as Element).getAttribute('iedName')).to.equal(
      'GOOSE_Subscriber'
    );
    expect((commEdit!.node as Element).getAttribute('apName')).to.equal('AP1');
    expect(commEdit!.parent.nodeName).to.equal('SubNetwork');
  });

  it('creates only the Private node when ConnectedAP already exists', () => {
    const testDoc = new DOMParser().parseFromString(
      getCommEditDoc,
      'application/xml'
    );
    const addr = testDoc.querySelector('SMV[cbName="fullSmv"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'SMV_Subscriber');

    expect(commEdit!.node.nodeName).to.equal('Private');
    expect(commEdit!.parent.nodeName).to.equal('ConnectedAP');
    expect((commEdit!.parent as Element).getAttribute('iedName')).to.equal(
      'SMV_Subscriber'
    );
    expect((commEdit!.parent as Element).getAttribute('apName')).to.equal(
      'AP1'
    );
  });

  it('falls back to No Access Point Found when ExtRef for cbName is missing', () => {
    const testDoc = new DOMParser().parseFromString(
      getCommEditDoc,
      'application/xml'
    );
    const addr = testDoc.querySelector('SMV[cbName="voltageOnly"]')!;
    const privateSCL = createSubscribedAddress(addr)!;
    const commEdit = getCommEdit(addr, privateSCL, 'UnknownSubscriber');

    expect(commEdit!.node.nodeName).to.equal('ConnectedAP');
    expect((commEdit!.node as Element).getAttribute('iedName')).to.equal(
      'UnknownSubscriber'
    );
    expect((commEdit!.node as Element).getAttribute('apName')).to.equal(
      'No Access Point Found'
    );
  });
});

describe('crossProduct', () => {
  it('returns [[]] for no inputs', () => {
    expect(crossProduct()).to.deep.equal([[]]);
  });

  it('returns all ordered combinations for multiple arrays', () => {
    expect(crossProduct(['1', '2'], ['A', 'B'])).to.deep.equal([
      ['1', 'A'],
      ['1', 'B'],
      ['2', 'A'],
      ['2', 'B']
    ]);
  });

  it('returns an empty array when any input array is empty', () => {
    expect(crossProduct(['1', '2'], [], ['X'])).to.deep.equal([]);
  });
});
