import { expect } from '@open-wc/testing';

import { getUsedCBs } from './getUsedCBs.js';
import { getUsedCBsDoc } from './getUsedCBs.testfiles.js';

const testDoc = new DOMParser().parseFromString(
  getUsedCBsDoc,
  'application/xml'
);

const testDoc2 = new DOMParser().parseFromString(
  `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
	<Header id="test" />
</SCL>`,
  'application/xml'
);

describe('Function to fetch control blocks', () => {
  it('returns used GSEControl and SampledValueControl control blocks', () => {
    const cbs = getUsedCBs(testDoc);
    const cbNames = Array.from(cbs!.keys()).map(cb => cb.getAttribute('name'));
    expect(cbNames).is.eql(['fullSmv', 'GOOSE2', 'GOOSE2']);
  });

  it('correctly shows IEDs using the control blocks', () => {
    const cbs = getUsedCBs(testDoc);

    const keySmv = Array.from(cbs!.keys()).find(
      cb => cb.getAttribute('name') === 'fullSmv'
    )!;
    const keyGOOSE2 = Array.from(cbs!.keys()).find(
      cb => cb.getAttribute('name') === 'GOOSE2'
    )!;

    expect(cbs!.get(keySmv)).is.eql(['SMV_Subscriber']);
    expect(cbs!.get(keyGOOSE2)).is.eql([
      'GOOSE_Subscriber',
      'GOOSE_Subscriber2'
    ]);
  });

  it('returns null if no control bocks blocks', () => {
    const cbs = getUsedCBs(testDoc2);
    expect(cbs).is.equal(null);
  });
});
