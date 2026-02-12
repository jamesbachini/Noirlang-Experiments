import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function wasmMimePlugin() {
  const setWasmMime = (req, res, next) => {
    const url = req.url || '';
    if (url.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
    next();
  };

  return {
    name: 'wasm-mime-plugin',
    configureServer(server) {
      server.middlewares.use(setWasmMime);
    },
    configurePreviewServer(server) {
      server.middlewares.use(setWasmMime);
    },
  };
}

export default defineConfig({
  plugins: [wasmMimePlugin()],
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: [
      '@noir-lang/noir_js',
      '@noir-lang/acvm_js',
      '@noir-lang/noirc_abi',
      '@aztec/bb.js',
    ],
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
});
