import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import legacy from "@vitejs/plugin-legacy";


const addScriptCSPNoncePlaceholderPlugin = () => {
  return {
    name: "add-script-nonce-placeholderP-plugin",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(htmlData) {

        return htmlData.replaceAll(
          /<script nomodule>/gi,
          `<script nomodule nonce="__CSP_NONCE__">`
        ).replaceAll(
          /<script type="module">/gi,
          `<script type="module" nonce="__CSP_NONCE__">`
        ).replaceAll(
          /<script nomodule crossorigin id="vite-legacy-entry"/gi,
          `<script nomodule crossorigin id="vite-legacy-entry" nonce="__CSP_NONCE__"`
        );
      },
    },
  };
};

export default defineConfig((env) => {
  return {
    build: {
      outDir: 'build',
      assetsDir: 'static/assets',
      manifest: 'asset-manifest.json',
      sourcemap: true,
      chunkSizeWarningLimit: 300,
      rollupOptions: {
        output: {
          manualChunks: {
            // React ecosystem
            'react-vendor': ['react', 'react-dom'],
            
            // MUI components (largest chunk)
            'mui-core': ['@mui/material'],
            'mui-icons': ['@mui/icons-material'],
            'emotion': ['@emotion/react', '@emotion/styled'],
            
            // Routing
            'react-router': ['react-router', 'react-router-dom'],
            
            // Redux ecosystem  
            'redux': ['@reduxjs/toolkit', 'react-redux', 'redux-logger'],
            
            // i18n ecosystem
            'i18n': [
              'i18next', 
              'react-i18next', 
              'i18next-browser-languagedetector',
              'i18next-http-backend',
              'i18next-resources-to-backend'
            ],
            
            // Utilities
            'utils': ['axios', 'validator', 'query-string', 'classnames', 'render-if']
          }
        }
      }
    },
    base: './',
    server: {
      port: 3001,
      strictPort: true,
      host: '127.0.0.1',
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
        clientPort: 3001,
      },
    },
    plugins: [
      react(),
      legacy({
        targets: ['edge 18'],
      }),
      env.mode !== "test" &&
        checker({
          typescript: true,
        }),
      addScriptCSPNoncePlaceholderPlugin(),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.js',
    },
  };
});
