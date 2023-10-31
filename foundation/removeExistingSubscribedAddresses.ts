import { Remove } from '@openscd/open-scd-core';

/**
 * Removes existing `Private` address elements in preparation for
 * rewriting.
 * @returns Remove edit array.
 */
export function removeExistingSubscribedAddresses(doc: XMLDocument): Remove[] {
  return Array.from(
    doc.querySelectorAll(
      'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
    )
  ).map(element => ({ node: element }));
}
