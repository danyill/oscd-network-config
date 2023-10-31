import { getReference } from '@openenergytools/scl-lib';
import { createElement } from '@openenergytools/scl-lib/dist/foundation/utils';
import { Insert } from '@openscd/open-scd-core';

export function getCommEdit(
  address: Element,
  privateSCL: Element,
  iedName: string
): Insert | undefined {
  // const apIedNameRx = address.closest('ConnectedAP')!.getAttribute('iedName');
  const apName = address.closest('ConnectedAP')!.getAttribute('apName');

  const subNetwork = address.closest('SubNetwork')!;
  const doc = address.ownerDocument;

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
