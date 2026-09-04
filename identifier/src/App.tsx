import { lazy, Suspense } from "react";

import CssBaseline from "@mui/material/CssBaseline";
import type { Theme } from "@mui/material/styles";
import { ThemeProvider } from "@mui/material/styles";

import ProgressStrip from "./components/ProgressStrip";
import * as version from "./version";

const LazyMain = lazy(() => import("./Main"));

console.info(`Kopano Identifier build version: ${version.build}`);

export interface AppProps {
  /*
   * Handed in rather than imported, because the page's background has to be
   * addressed under the prefix the webapp is served from, and that is only
   * known once the document has been read.
   */
  theme: Theme;
}

/*
 * No StyledEngineProvider here: the emotion cache created in index.tsx is
 * built with prepend, which puts the generated styles ahead of anything
 * imported alongside it so those can still override them.
 */
const App = ({ theme }: AppProps) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Suspense fallback={<ProgressStrip />}>
        <LazyMain />
      </Suspense>
    </ThemeProvider>
  );
};

export default App;
