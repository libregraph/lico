import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { History } from "history";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";

import { executeHello, executeLogoff } from "../../actions/common";
import ResponsiveScreen from "../../components/ResponsiveScreen";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";

export interface GoodbyescreenProps {
  // Supplied by the Route which renders this screen.
  history: History;
}

function Goodbyescreen(props: GoodbyescreenProps) {
  const { history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const branding = useAppSelector((state) => state.common.branding);
  const hello = useAppSelector((state) => state.common.hello);

  // dispatch is stable for the store's lifetime, so this runs once on mount.
  useEffect(() => {
    dispatch(executeHello());
  }, [dispatch]);

  const handleLogoff = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response) => {
      // Signing off clears the session before the request goes out, so the
      // screen has nothing to show until it is read again. That has to happen
      // whether or not the server agreed, otherwise a refusal leaves the user
      // on a progress indicator with no way forward.
      dispatch(executeHello());

      if (response.success) {
        history.push("/goodbye");
      }
    });
  };

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding}>
      {hello !== null && !hello.state && (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.headline", "Goodbye")}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 5 }}>
            {t("konnect.goodbye.subHeader", "you have been signed out from your account")}
          </Typography>
          <Typography gutterBottom>{t("konnect.goodbye.message.close", "You can close this window now.")}</Typography>
        </div>
      )}
      {hello !== null && hello.state === true && (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.confirm.headline", "Hello {{displayName}}", { displayName: hello.displayName })}
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 5 }}>
            {t("konnect.goodbye.confirm.subHeader", "please confirm sign out")}
          </Typography>

          <Typography gutterBottom>
            {t("konnect.goodbye.message.confirm", "Press the button below, to sign out from your account now.")}
          </Typography>

          <DialogActions>
            <Box sx={{ mt: 5, position: "relative", display: "inline-block" }}>
              <Button color="secondary" variant="outlined" onClick={handleLogoff}>
                {t("konnect.goodbye.signoutButton.label", "Sign out")}
              </Button>
            </Box>
          </DialogActions>
        </div>
      )}
    </ResponsiveScreen>
  );
}

export default Goodbyescreen;
