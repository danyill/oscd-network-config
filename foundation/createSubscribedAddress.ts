export const TPNS = 'https://transpower.co.nz/SCL/SCD/Communication/v1';
export const XSINS = 'http://www.w3.org/2001/XMLSchema-instance';

/**
 * Creates either a Transpower-GSE-Subscribe or Transpower-SMV-Subscribe
 * element which has `P` elements which provide the MAC address
 * VLAN-ID and and VLAN-Priority similar to the standard's GSE and SMV
 * elements
 * @param address - SCL address element `GSE` or `SMV`.
 * @returns - an Element or undefined if nothing to create
 */
export function createSubscribedAddress(address: Element): Element | null {
  const privateSCL = address.ownerDocument.createElementNS(
    address.ownerDocument.documentElement.namespaceURI,
    'Private'
  );
  privateSCL.setAttribute('type', `Transpower-${address.tagName}-Subscribe`);

  const iedName = address.closest('ConnectedAP')!.getAttribute('iedName')!;

  privateSCL.setAttributeNS(TPNS, 'iedName', iedName);

  const cbName = address.getAttribute('cbName');
  if (cbName) privateSCL.setAttributeNS(TPNS, 'cbName', cbName);

  const ldInst = address.getAttribute('ldInst');
  if (ldInst) privateSCL.setAttributeNS(TPNS, 'ldInst', ldInst);

  const newAddress = address.ownerDocument.createElementNS(TPNS, 'Address');
  privateSCL.appendChild(newAddress);

  const addressVlan = address.querySelector('P[type="VLAN-ID"]');
  if (addressVlan) {
    const vlanId = address.ownerDocument.createElementNS(TPNS, 'P');
    vlanId.setAttribute('type', 'VLAN-ID');
    vlanId.setAttributeNS(XSINS, 'type', 'tP_VLAN-ID');
    vlanId.textContent = addressVlan.textContent;
    newAddress.appendChild(vlanId);
  }

  const addressVlanPriority = address.querySelector('P[type="VLAN-PRIORITY"]');
  if (addressVlanPriority) {
    const vlanPriority = address.ownerDocument.createElementNS(TPNS, 'P');
    vlanPriority.setAttribute('type', 'VLAN-PRIORITY');
    vlanPriority.setAttributeNS(XSINS, 'type', 'tP_VLAN-PRIORITY');
    vlanPriority.textContent = addressVlanPriority.textContent;
    newAddress.appendChild(vlanPriority);
  }

  const addressMac = address.querySelector('P[type="MAC-Address"]');
  if (addressMac) {
    const mac = address.ownerDocument.createElementNS(TPNS, 'P');
    mac.setAttribute('type', 'MAC-Address');
    mac.setAttributeNS(XSINS, 'type', 'tP_MAC-Address');
    mac.textContent = addressMac.textContent;
    newAddress.appendChild(mac);
  }

  // only proceed if there is something to write
  if (!(addressVlan || addressVlanPriority || addressMac)) {
    return null;
  }
  return privateSCL;
}
