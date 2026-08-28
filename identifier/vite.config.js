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
    resolve: {
      // react-router and hoist-non-react-statics each resolve a react-is of
      // their own, which puts three copies of it in the bundle. react-is tracks
      // the React major, so the one copy to keep is the one matching React.
      dedupe: ['react-is'],
    },
    build: {
      outDir: 'build',
      assetsDir: 'static/assets',
      manifest: 'asset-manifest.json',
      sourcemap: true,
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
        // Type checking only. vite-plugin-checker's biome mode needs
        // vite >= 5.4.21 and this is Vite 4.5, so the dev server has no inline
        // lint feedback: lint runs through the bun script and the Makefile.
        checker({
          typescript: true,
        }),
      splitVendorChunkPlugin(),
      addScriptCSPNoncePlaceholderPlugin(),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.js',
    },
  };
});
