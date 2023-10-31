// import { expect, fixture } from '@open-wc/testing';

// import { LitElement, html } from 'lit';

// import {
//   networkDataTestDoc,
//   networkDataTestDocMissingGSEAddressInfo,
//   networkDataTestDocWithoutAddresses
// } from './oscd-network-config.testfiles.js';

// import '@openscd/open-scd-core/open-scd.js';

// import type NetworkConfig from './oscd-network-config.js';

// type OpenSCD = LitElement & {
//   editor: string;
//   docName: string;
//   docs: Record<string, XMLDocument>;
// };

// let editor: OpenSCD;
// let plugin: NetworkConfig;
// let script: HTMLScriptElement;

// function timeout(ms: number) {
//   return new Promise(res => {
//     setTimeout(res, ms);
//   });
// }

// beforeEach(async () => {
//   const plugins = {
//     editor: [
//       {
//         name: 'Network Data',
//         icon: 'link',
//         active: true,
//         requireDoc: true,
//         src: '/dist/oscd-network-config.js'
//       }
//     ]
//   };

//   script = document.createElement('script');
//   script.type = 'module';

//   script.textContent = `
//     const _customElementsDefine = window.customElements.define;
//     window.customElements.define = (name, cl, conf) => {
//       if (!customElements.get(name)) {
//         try {
//           _customElementsDefine.call(
//             window.customElements,
//             name,
//             cl,
//             conf
//           );
//         } catch (e) {
//           console.warn(e);
//         }
//       }
//     };
//   `;
//   document.head.appendChild(script);

//   const ed = await fixture(
//     html`<open-scd
//       language="en"
//       plugins="${JSON.stringify(plugins)}"
//     ></open-scd>`
//   );
//   document.body.prepend(ed);

//   editor = document.querySelector<OpenSCD>('open-scd')!;
//   plugin = document
//     .querySelector('open-scd')!
//     .shadowRoot!.querySelector<NetworkConfig>(editor.editor)!;

//   await document.fonts.ready;
// });

// afterEach(() => {
//   editor.remove();
//   plugin.remove();
//   script.remove();
// });

// describe('Creates Private subscription communication elements', () => {
//   it('Creates the expected number of subscription elements', async () => {
//     const doc = new DOMParser().parseFromString(
//       networkDataTestDoc,
//       'application/xml'
//     );

//     editor.docName = 'Test.scd';
//     editor.docs[editor.docName] = doc;

//     await editor.updateComplete;
//     await plugin.updateComplete;

//     await timeout(1000); // plugin loading and initial render?

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);

//     // run menu plugin
//     await plugin.run();

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(3);
//   });

//   it('Does nothing if there are no control blocks', async () => {
//     const doc = new DOMParser().parseFromString(
//       `<?xml version="1.0" encoding="UTF-8"?>
// <SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
// 	<Header id="test" />
// </SCL>`,
//       'application/xml'
//     );

//     editor.docName = 'Test.scd';
//     editor.docs[editor.docName] = doc;

//     await editor.updateComplete;
//     await plugin.updateComplete;

//     await timeout(600); // plugin loading and initial render?

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);

//     // run menu plugin
//     await plugin.run();

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);
//   });

//   it('Creates no addresses if there are no existing GSE or SMV addresses', async () => {
//     const doc = new DOMParser().parseFromString(
//       networkDataTestDocWithoutAddresses,
//       'application/xml'
//     );

//     editor.docName = 'Test.scd';
//     editor.docs[editor.docName] = doc;

//     await editor.updateComplete;
//     await plugin.updateComplete;

//     await timeout(600); // plugin loading and initial render?

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);

//     // run menu plugin
//     await plugin.run();

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);
//   });

//   it('Creates addresses and handles GSE or SMV elements even with some not having information for rewriting', async () => {
//     const doc = new DOMParser().parseFromString(
//       networkDataTestDocMissingGSEAddressInfo,
//       'application/xml'
//     );

//     editor.docName = 'Test.scd';
//     editor.docs[editor.docName] = doc;

//     await editor.updateComplete;
//     await plugin.updateComplete;

//     await timeout(600); // plugin loading and initial render?

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(0);

//     // run menu plugin
//     await plugin.run();

//     expect(
//       plugin.doc.querySelectorAll(
//         'Private[type="Transpower-GSE-Subscribe"], Private[type="Transpower-SMV-Subscribe"]'
//       ).length
//     ).to.equal(2);
//   });
// });
