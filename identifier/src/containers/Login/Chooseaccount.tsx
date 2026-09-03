import { useTranslation } from "react-i18next";

import Avatar from "@mui/material/Avatar";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeLogonIfFormValid } from "../../actions/login";
import RequestError from "../../components/RequestError";
import { useFlowNavigation, useRedirectUnlessPushed } from "../../hooks/navigation";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectHello } from "../../reducers/common";
import { selectErrors, selectLoading } from "../../reducers/login";
import { withSearchAndHash } from "../../utils";

function Chooseaccount() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const nav = useFlowNavigation();
  const hello = useAppSelector(selectHello);
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  // A visitor without a session has nothing to choose between.
  const redirecting = useRedirectUnlessPushed(!hello?.state);

  // Both the form and the account entry reach this, so the event is only ever
  // used to stop the default submission.
  const handleLogon = (event: React.SyntheticEvent) => {
    event.preventDefault();

    // The mount guard sends a visitor without a session away, so a name is
    // present by the time this can be reached. Validation reports an empty one
    // rather than this throwing if that ever stops holding.
    dispatch(executeLogonIfFormValid(hello?.username ?? "", "", true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, nav));
      }
    });
  };

  const handleLogoff = (event: React.SyntheticEvent) => {
    event.preventDefault();

    nav.navigate(withSearchAndHash("/identifier", nav.location));
  };

  // Nothing to show while the guard above is sending the visitor away.
  if (redirecting) {
    return null;
  }

  const username = hello?.state ? (hello.username ?? "") : "";

  return (
    <DialogContent sx={{ overflowY: "visible" }}>
      <Typography variant="h5" component="h3">
        {t("konnect.chooseaccount.headline", "Choose an account")}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {t("konnect.chooseaccount.subHeader", "to sign in")}
      </Typography>

      <form action="" onSubmit={handleLogon}>
        <List disablePadding sx={{ ml: -5, mr: -5 }}>
          <ListItem disableGutters disablePadding>
            <ListItemButton sx={{ pl: 5, pr: 5 }} disabled={!!loading} onClick={handleLogon}>
              <ListItemAvatar>
                <Avatar>{username.slice(0, 1)}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={username} />
            </ListItemButton>
          </ListItem>
          <ListItem disableGutters disablePadding>
            <ListItemButton sx={{ pl: 5, pr: 5 }} disabled={!!loading} onClick={handleLogoff}>
              <ListItemAvatar>
                <Avatar>{t("konnect.chooseaccount.useOther.persona.label", "?")}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={t("konnect.chooseaccount.useOther.label", "Use another account")} />
            </ListItemButton>
          </ListItem>
        </List>

        <RequestError error={errors.http} />
      </form>
    </DialogContent>
  );
}

export default Chooseaccount;
