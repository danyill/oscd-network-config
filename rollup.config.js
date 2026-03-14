import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const pluginConfig = {
  input: './oscd-network-config.ts',
  output: {
    sourcemap: true, // Add source map to build output
    format: 'es', // ES module type export
    dir: 'dist' // The build output folder
    // preserveModules: true,  // Keep directory structure and files
  },
  preserveEntrySignatures: 'strict', // leaves export of the plugin entry point

  plugins: [
    /** Resolve bare module imports */
    importMetaAssets(),
    nodeResolve(),
    typescript()
  ]
};

/** Bundle the shell + polyfill so index.html has no bare module specifiers */
const demoConfig = {
  input: './demo/shell.deploy.js',
  output: {
    sourcemap: true,
    format: 'es',
    file: 'dist/demo/shell.deploy.js'
  },
  plugins: [
    nodeResolve(),
    copy({
      targets: [
        { src: 'demo/index.deploy.html', dest: 'dist', rename: 'index.html' },
        { src: 'demo/plugins.deploy.js', dest: 'dist/demo' },
        { src: 'demo/sysconex-theme/*', dest: 'dist/demo/sysconex-theme' }
      ]
    }),
    importMetaAssets(),
    nodeResolve(),
    typescript()
  ]
};

export default [pluginConfig, demoConfig];
