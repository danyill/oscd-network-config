import { expect } from '@open-wc/testing';

import { handleEdit } from '@openscd/open-scd-core';
import { removeExistingSubscribedAddresses } from './removeExistingSubscribedAddresses.js';
import { removeExistingSubscribedAddressesDoc } from './removeExistingSubscribedAddresses.test.js';

const testDoc = new DOMParser().parseFromString(
  removeExistingSubscribedAddressesDoc,
  'application/xml'
);

describe('Remove existing subscribed addresses', () => {
  it('returns used GSEControl and SampledValueControl control blocks', () => {
    const existingSubscribedGSEandSMV = testDoc.querySelectorAll(
      'Private[type="Transpower-GSE-Subscribe"],Private[type="Transpower-SMV-Subscribe"]'
    );
    expect(existingSubscribedGSEandSMV.length).to.equal(5);

    handleEdit(removeExistingSubscribedAddresses(testDoc));

    const afterEditSubscribedGSEandSMV = testDoc.querySelectorAll(
      'Private[type="Transpower-GSE-Subscribe"],Private[type="Transpower-SMV-Subscribe"]'
    );
    expect(afterEditSubscribedGSEandSMV.length).to.equal(0);
  });
});
