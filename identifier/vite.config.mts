import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import type { ConfigEnv, Plugin } from "vite";
import checker from "vite-plugin-checker";
import type { ViteUserConfig } from "vitest/config";
import { defineConfig } from "vitest/config";

/*
 * The server writes a fresh nonce into the document on every request and the
 * policy admits scripts carrying it, so the scripts Vite emits need the
 * placeholder to substitute. Build only: the dev server sends no policy.
 *
 * The module entry is nonced even though the policy already admits it by origin,
 * because a module's dependency fetches inherit the nonce of the element that
 * started them. Without one, plugin-legacy's probe inside the entry chunk — an
 * import of a `data:` URL, which no origin admits — is refused, the entry never
 * evaluates and the page renders nothing at all.
 */
const addScriptCSPNoncePlaceholderPlugin = (): Plugin => {
  return {
    name: "add-script-nonce-placeholderP-plugin",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(htmlData: string) {
        return htmlData
          .replaceAll(/<script nomodule>/gi, `<script nomodule nonce="__CSP_NONCE__">`)
          .replaceAll(/<script type="module">/gi, `<script type="module" nonce="__CSP_NONCE__">`)
          .replaceAll(/<script type="module" crossorigin/gi, `<script type="module" crossorigin nonce="__CSP_NONCE__"`)
          .replaceAll(
            /<script nomodule crossorigin id="vite-legacy-entry"/gi,
            `<script nomodule crossorigin id="vite-legacy-entry" nonce="__CSP_NONCE__"`,
          );
      },
    },
  };
};

export default defineConfig((env: ConfigEnv): ViteUserConfig => {
  return {
    resolve: {
      // react-router and hoist-non-react-statics each resolve a react-is of
      // their own, which puts three copies of it in the bundle. react-is tracks
      // the React major, so the one copy to keep is the one matching React.
      dedupe: ["react-is"],
    },
    build: {
      outDir: "build",
      assetsDir: "static/assets",
      manifest: "asset-manifest.json",
      sourcemap: true,
      // terser is smaller than the default minifier here, and it is already a
      // dependency because plugin-legacy minifies the legacy chunks with it.
      // The second compress pass is worth a further couple of KB and applies to
      // those chunks too.
      minify: "terser",
      terserOptions: {
        compress: {
          passes: 2,
        },
      },
      /*
       * No chunk groups on purpose. Collecting every installed package into one
       * vendor chunk, which is what the removed vendor chunk plugin did, makes
       * each route pay for every other route's dependencies: it cost 76 kB on
       * the sign-out screen and saved 1 kB on sign-in, and put a 528 kB chunk
       * past the size warning. Left alone, the splitter keeps a chunk per lazy
       * route and shares what more than one of them reaches for.
       */
    },
    base: "./",
    server: {
      port: 3001,
      strictPort: true,
      host: "127.0.0.1",
      hmr: {
        protocol: "ws",
        host: "127.0.0.1",
        clientPort: 3001,
      },
    },
    plugins: [
      react(),
      legacy({
        targets: ["edge 18"],
      }),
      /*
       * Types, lint, formatting and import order in the dev overlay, and a gate
       * on the production build. Skipped under test, where vitest does its own
       * transform and the suite is the gate. The command and flags match the bun
       * script and the Makefile target, so the overlay and the command line
       * agree on what fails: biome reports most rules as warnings, which are
       * errors for this project.
       */
      env.mode !== "test" &&
        checker({
          typescript: true,
          biome: {
            command: "check",
            flags: "--error-on-warnings .",
          },
        }),
      addScriptCSPNoncePlaceholderPlugin(),
    ],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.js",
    },
  };
});
