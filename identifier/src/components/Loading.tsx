import type React from "react";
import { useTranslation } from "react-i18next";

import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

import { retryHello } from "../actions/common";
import { ErrorMessage } from "../errors";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { selectError } from "../reducers/common";

/*
 * Grid's root is a div, and React's div typings dropped the deprecated align
 * attribute, so it cannot be written inline. It still reaches the DOM.
 */
const legacyAlign = { align: "center" };

export interface LoadingProps {
  /*
   * Milliseconds to wait before the bar fades in. A wait which ends inside that
   * window shows nothing at all, which is what keeps a screen that is only
   * being passed through from flashing a progress bar for two frames. The
   * failure below is never delayed, because by then there is nothing left to
   * wait for.
   */
  delay?: number;
}

function Loading({ delay = 0 }: LoadingProps) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);

  const handleRetry = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(retryHello());
  };

  const bar = <LinearProgress sx={{ height: "4px", width: "100px" }} />;

  return (
    <Grid
      container
      spacing={0}
      sx={{
        flexGrow: 1,
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Grid {...legacyAlign}>
        {error === null ? (
          delay > 0 ? (
            <Fade in style={{ transitionDelay: `${delay}ms` }}>
              {bar}
            </Fade>
          ) : (
            bar
          )
        ) : (
          <div>
            <Typography variant="h5" gutterBottom align="center">
              {t("konnect.loading.error.headline", "Failed to connect to server")}
            </Typography>
            <Typography gutterBottom align="center" color="error">
              <ErrorMessage error={error}></ErrorMessage>
            </Typography>
            <Button autoFocus color="primary" variant="outlined" sx={{ mt: 5 }} onClick={handleRetry}>
              {t("konnect.login.retryButton.label", "Retry")}
            </Button>
          </div>
        )}
      </Grid>
    </Grid>
  );
}

export default Loading;
