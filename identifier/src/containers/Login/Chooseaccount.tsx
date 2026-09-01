import { useEffect } from 'react';
import type { History } from 'history';

import { useTranslation } from 'react-i18next';

import { createStyles, withStyles } from '@material-ui/core/styles';
import type { Theme } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import DialogContent from '@material-ui/core/DialogContent';

import { executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import { withSearchAndHash } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';

const styles = (theme: Theme) => createStyles({
  content: {
    overflowY: 'visible',
  },
  subHeader: {
    marginBottom: theme.spacing(2)
  },
  message: {
    marginTop: theme.spacing(2)
  },
  accountList: {
    marginLeft: theme.spacing(-5),
    marginRight: theme.spacing(-5)
  },
  accountListItem: {
    paddingLeft: theme.spacing(5),
    paddingRight: theme.spacing(5)
  }
});

export interface ChooseaccountProps {
  classes: {
    content: string;
    subHeader: string;
    message: string;
    accountList: string;
    accountListItem: string;
  };
  // Supplied by the Route which renders this screen.
  history: History;
}

function Chooseaccount(props: ChooseaccountProps) {
  const { classes, history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const hello = useAppSelector(state => state.common.hello);
  const loading = useAppSelector(state => state.login.loading);
  const errors = useAppSelector(state => state.login.errors);

  // This guard sends a visitor without a session back to the sign-in form, once,
  // on mount. Naming hello or history as dependencies would re-run it whenever
  // the session changes and could redirect the visitor mid-flow.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if ((!hello?.state) && history.action !== 'PUSH') {
      history.replace(withSearchAndHash('/identifier', history.location));
    }
  }, []);

  // Both the form and the account entry reach this, so the event is only ever
  // used to stop the default submission.
  const handleLogon = (event: React.SyntheticEvent) => {
    event.preventDefault();

    // The mount guard sends a visitor without a session away, so a name is
    // present by the time this can be reached. Validation reports an empty one
    // rather than this throwing if that ever stops holding.
    dispatch(executeLogonIfFormValid(hello?.username ?? '', '', true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  };

  const handleLogoff = (event: React.SyntheticEvent) => {
    event.preventDefault();

    history.push(withSearchAndHash('/identifier', history.location));
  };

  let errorMessage = null;
  if (errors.http) {
    errorMessage = <Typography color="error" className={classes.message}>
      <ErrorMessage error={errors.http}></ErrorMessage>
    </Typography>;
  }

  let username = '';
  if (hello?.state) {
    username = hello.username ?? '';
  }

  return (
    <DialogContent className={classes.content}>
      <Typography variant="h5" component="h3">
        {t("konnect.chooseaccount.headline", "Choose an account")}
      </Typography>
      <Typography variant="subtitle1" className={classes.subHeader}>
        {t("konnect.chooseaccount.subHeader", "to sign in")}
      </Typography>

      <form action="" onSubmit={handleLogon}>
        <List disablePadding className={classes.accountList}>
          <ListItem
            button
            disableGutters
            className={classes.accountListItem}
            disabled={!!loading}
            onClick={handleLogon}
          ><ListItemAvatar><Avatar>{username.slice(0, 1)}</Avatar></ListItemAvatar>
            <ListItemText primary={username} />
          </ListItem>
          <ListItem
            button
            disableGutters
            className={classes.accountListItem}
            disabled={!!loading}
            onClick={handleLogoff}
          >
            <ListItemAvatar>
              <Avatar>
                {t("konnect.chooseaccount.useOther.persona.label", "?")}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                t("konnect.chooseaccount.useOther.label", "Use another account")
              }
            />
          </ListItem>
        </List>

        {errorMessage}
      </form>
    </DialogContent>
  );
}

export default withStyles(styles)(Chooseaccount);
