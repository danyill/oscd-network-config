import { expect } from '@open-wc/testing';

import { handleEdit } from '@openscd/open-scd-core';
import { updateNamespaces } from './updateNamespaces.js';

const testDoc = new DOMParser().parseFromString(
  `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
	<Header id="test" />
</SCL>`,
  'application/xml'
);

const testDoc2 = new DOMParser().parseFromString(
  `<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:etpc="https://transpower.co.nz/SCL/SCD/Communication/v1">
	<Header id="test" />
</SCL>`,
  'application/xml'
);

describe('Remove existing subscribed addresses', () => {
  it('Adds etpc and xsi namespaces to a document', () => {
    expect(
      testDoc.documentElement.attributes.getNamedItemNS(
        'http://www.w3.org/2000/xmlns/',
        'etpc'
      )
    ).to.equal(null);
    expect(
      testDoc.documentElement.attributes.getNamedItemNS(
        'http://www.w3.org/2000/xmlns/',
        'xsi'
      )
    ).to.equal(null);

    handleEdit(updateNamespaces(testDoc)!);

    expect(
      testDoc.documentElement.attributes.getNamedItemNS(
        'http://www.w3.org/2000/xmlns/',
        'etpc'
      )!.value
    ).to.equal('https://transpower.co.nz/SCL/SCD/Communication/v1');
    expect(
      testDoc.documentElement.attributes.getNamedItemNS(
        'http://www.w3.org/2000/xmlns/',
        'xsi'
      )!.value
    ).to.equal('http://www.w3.org/2001/XMLSchema-instance');
  });

  it('Returns null if namespaces already exist', () => {
    expect(updateNamespaces(testDoc2)).to.equal(undefined);
  });
});
