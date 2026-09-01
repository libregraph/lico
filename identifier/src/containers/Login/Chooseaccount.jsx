import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { withStyles } from '@material-ui/core/styles';
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

const styles = theme => ({
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

function Chooseaccount(props) {
  const { classes, history } = props;

  const { t } = useTranslation();

  const dispatch = useDispatch();
  const hello = useSelector(state => state.common.hello);
  const loading = useSelector(state => state.login.loading);
  const errors = useSelector(state => state.login.errors);

  // This guard sends a visitor without a session back to the sign-in form, once,
  // on mount. Naming hello or history as dependencies would re-run it whenever
  // the session changes and could redirect the visitor mid-flow.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if ((!hello?.state) && history.action !== 'PUSH') {
      history.replace(withSearchAndHash('/identifier', history.location));
    }
  }, []);

  const handleLogon = (event) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(hello.username, '', true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  };

  const handleLogoff = (event) => {
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
    username = hello.username;
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

Chooseaccount.propTypes = {
  classes: PropTypes.object.isRequired,

  history: PropTypes.object.isRequired
};

export default withStyles(styles)(Chooseaccount);
