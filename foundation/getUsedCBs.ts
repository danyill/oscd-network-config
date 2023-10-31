import { sourceControlBlock } from '@openenergytools/scl-lib';

/**
 * Ensures the nearest element is not within a Private element.
 *
 * @param element
 * @returns
 */
function isPublic(element: Element): boolean {
  return !element.closest('Private');
}

export function getUsedCBs(doc: XMLDocument): Map<Element, string[]> | null {
  // fetch unique control blocks and subscribing IEDs
  const controlBlocksAndIEDs = new Map<Element, string[]>();
  Array.from(doc.querySelectorAll('Inputs > ExtRef'))
    .filter(isPublic)
    .forEach(extRef => {
      const cb = sourceControlBlock(extRef);
      const ied = extRef.closest('IED')!.getAttribute('name')!;

      if (!cb) return;

      // need to store IED and ConnectedAP apName
      const cbAlreadyExists = controlBlocksAndIEDs.has(cb);
      const cbHasIed = controlBlocksAndIEDs.get(cb)?.includes(ied);
      if (cbAlreadyExists && !cbHasIed) {
        controlBlocksAndIEDs.set(cb, [...controlBlocksAndIEDs.get(cb)!, ied]);
      } else if (!cbAlreadyExists) {
        controlBlocksAndIEDs.set(cb, [ied]);
      }
    });

  // provide stable order -- GOOSE then SV, sorted by IED and control block name
  const sortedControlBlocksAndIEDs = new Map(
    [...controlBlocksAndIEDs].sort((first, second) => {
      const firstKey = first[0];
      const secondKey = second[0];
      const comparison = (e: Element) =>
        `${e.tagName} ${e
          .closest('IED')!
          .getAttribute('name')} ${e.getAttribute('name')}`;
      return comparison(secondKey).localeCompare(comparison(firstKey));
    })
  );

  // sort the order IEDs are processed
  sortedControlBlocksAndIEDs.forEach((value, key) => {
    sortedControlBlocksAndIEDs.set(key, value.sort());
  });

  return sortedControlBlocksAndIEDs.size === 0
    ? null
    : sortedControlBlocksAndIEDs;
}
