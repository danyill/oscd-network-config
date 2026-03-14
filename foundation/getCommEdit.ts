import { getReference } from '@openscd/scl-lib';
import { createElement } from '@openscd/scl-lib/dist/foundation/utils.js';

import { Insert } from '@openscd/open-scd-core';

/** @returns the cartesian product of `arrays` */
export function crossProduct<T>(...arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => <T[][]>a.flatMap(d => b.map(e => [d, e].flat())),
    [[]]
  );
}

export function getCommEdit(
  address: Element,
  privateSCL: Element,
  iedName: string
): Insert | undefined {
  const doc = address.ownerDocument;

  const subNetwork = address.closest('SubNetwork')!;

  const cbName = address.getAttribute('cbName');

  // The apName is associated with the AccessPoint of the subscribing ExtRef
  // but this is not easy to determine if there are ServerAt directives and
  // the Services section
  const apName =
    doc
      .querySelector(
        `:root > IED[name="${iedName}"] > AccessPoint > Server > LDevice > LN0 > Inputs > ExtRef[srcCBName="${cbName}"], 
                     :root > IED[name="${iedName}"] > AccessPoint > Server > LDevice > LN > Inputs > ExtRef[srcCBName="${cbName}"]`
      )
      ?.closest('AccessPoint')
      ?.getAttribute('name') ?? 'No Access Point Found';

  // const otherAPs = Array.from(doc.querySelectorAll(`:root > IED[name="${iedName}"] > AccessPoint > ServerAt[apName="${apName}"]`)).map(serverAt => serverAt.closest('AccessPoint')?.getAttribute('name'))

  const connectedAp = subNetwork.querySelector(
    `ConnectedAP[iedName="${iedName}"][apName="${apName}"]`
  );

  let edit: Insert;

  if (connectedAp) {
    edit = {
      parent: connectedAp,
      node: privateSCL.cloneNode(true),
      reference: getReference(connectedAp, 'Private')
    };
  } else {
    // create new access point
    const newConnectedAp = createElement(doc, 'ConnectedAP', {
      apName,
      iedName
    });
    newConnectedAp.appendChild(privateSCL.cloneNode(true));

    edit = {
      parent: subNetwork,
      node: newConnectedAp,
      reference: getReference(subNetwork, 'ConnectedAP')
    };
  }
  return edit;
}
