import { Update } from '@openscd/open-scd-core';
import { TPNS, XSINS } from './createSubscribedAddress.js';

/**
 * Updates namespaces to include the XML schema instance and the
 * Transpower `etpc` namespaces for writing address elements.
 * @returns
 */
export function updateNamespaces(doc: XMLDocument): Update | undefined {
  const namespaceUpdate: Update = {
    element: doc.documentElement,
    attributes: {}
  };

  if (!doc.documentElement.hasAttribute('xmlns:etpc'))
    namespaceUpdate.attributes = {
      ...namespaceUpdate.attributes,
      'xmlns:etpc': {
        value: TPNS,
        namespaceURI: 'http://www.w3.org/2000/xmlns/'
      }
    };

  if (!doc.documentElement.hasAttribute('xmlns:xsi'))
    namespaceUpdate.attributes = {
      ...namespaceUpdate.attributes,
      'xmlns:xsi': {
        value: XSINS,
        namespaceURI: 'http://www.w3.org/2000/xmlns/'
      }
    };

  if (!(Object.entries(namespaceUpdate.attributes).length === 0))
    return namespaceUpdate;

  return undefined;
}
