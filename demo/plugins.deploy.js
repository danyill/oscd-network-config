import NetworkConfig from '../oscd-network-config.js';

const { registry } = document.querySelector('oscd-shell');
registry.define('oscd-network-config', NetworkConfig);

export const plugins = {
  menu: [
    {
      name: 'Open File',
      translations: { de: 'Datei öffnen' },
      icon: 'folder_open',
      src: 'https://openscd.github.io/oscd-open/oscd-open.js'
    },
    {
      name: 'Save File',
      translations: { de: 'Datei speichern' },
      icon: 'save',
      requireDoc: true,
      src: 'https://openscd.github.io/oscd-save/oscd-save.js'
    }
  ],
  editor: [
    {
      name: 'Network Config',
      icon: 'news',
      requireDoc: true,
      tagName: 'oscd-network-config'
    }
  ]
};
