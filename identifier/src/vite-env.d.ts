/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Stamped by the build. Absent in a plain dev server, which is why the one
  // reader falls back to a placeholder rather than showing undefined.
  readonly VITE_KOPANO_BUILD?: string;
}
