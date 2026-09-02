import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { History } from "history";

import Avatar from "@mui/material/Avatar";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeLogonIfFormValid } from "../../actions/login";
import { ErrorMessage } from "../../errors";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectHello } from "../../reducers/common";
import { selectErrors, selectLoading } from "../../reducers/login";
import { withSearchAndHash } from "../../utils";

export interface ChooseaccountProps {
  // Supplied by the Route which renders this screen.
  history: History;
}

function Chooseaccount(props: ChooseaccountProps) {
  const { history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const hello = useAppSelector(selectHello);
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  // This guard sends a visitor without a session back to the sign-in form, once,
  // on mount. Naming hello or history as dependencies would re-run it whenever
  // the session changes and could redirect the visitor mid-flow.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if (!hello?.state && history.action !== "PUSH") {
      history.replace(withSearchAndHash("/identifier", history.location));
    }
  }, []);

  // Both the form and the account entry reach this, so the event is only ever
  // used to stop the default submission.
  const handleLogon = (event: React.SyntheticEvent) => {
    event.preventDefault();

    // The mount guard sends a visitor without a session away, so a name is
    // present by the time this can be reached. Validation reports an empty one
    // rather than this throwing if that ever stops holding.
    dispatch(executeLogonIfFormValid(hello?.username ?? "", "", true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  };

  const handleLogoff = (event: React.SyntheticEvent) => {
    event.preventDefault();

    history.push(withSearchAndHash("/identifier", history.location));
  };

  let errorMessage = null;
  if (errors.http) {
    errorMessage = (
      <Typography color="error" sx={{ mt: 2 }}>
        <ErrorMessage error={errors.http}></ErrorMessage>
      </Typography>
    );
  }

  let username = "";
  if (hello?.state) {
    username = hello.username ?? "";
  }

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

        {errorMessage}
      </form>
    </DialogContent>
  );
}

export default Chooseaccount;
