import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";

import { executeLogoff } from "../../actions/common";
import ResponsiveScreen from "../../components/ResponsiveScreen";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectBranding, selectHello } from "../../reducers/common";

function Welcomescreen() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const branding = useAppSelector(selectBranding);
  const hello = useAppSelector(selectHello);

  const handleLogoff = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response) => {
      if (response.success) {
        navigate("/identifier");
      }
    });
  };

  // The children are built before ResponsiveScreen decides whether to show the
  // loading state, so return early rather than dereference a session which
  // signing out has already cleared.
  if (hello === null) {
    return <ResponsiveScreen loading branding={branding} />;
  }

  return (
    <ResponsiveScreen branding={branding}>
      <Typography variant="h5" component="h3">
        {t("konnect.welcome.headline", "Welcome {{displayName}}", { displayName: hello.displayName })}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 5 }}>
        {hello.username}
      </Typography>

      <Typography gutterBottom>{t("konnect.welcome.message", "You are signed in - awesome!")}</Typography>

      <DialogActions>
        <Button color="secondary" sx={{ m: 1, minWidth: 100 }} variant="contained" onClick={handleLogoff}>
          {t("konnect.welcome.signoutButton.label", "Sign out")}
        </Button>
      </DialogActions>
    </ResponsiveScreen>
  );
}

export default Welcomescreen;
