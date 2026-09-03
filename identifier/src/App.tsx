import { lazy, Suspense } from "react";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

import "./App.css";
import "./fancy-background.css";

import ProgressStrip from "./components/ProgressStrip";
import theme from "./theme";
import * as version from "./version";

const LazyMain = lazy(() => import("./Main"));

console.info(`Kopano Identifier build version: ${version.build}`);

/*
 * No StyledEngineProvider here: the emotion cache created in index.tsx is
 * built with prepend, which puts the generated styles ahead of the stylesheets
 * imported above so those can still override them.
 */
const App = () => {
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
