import React from 'react';
import { connect } from 'react-redux';
import { History } from 'history';

import { withTranslation } from 'react-i18next';

import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import DialogContent from '@material-ui/core/DialogContent';

import { executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage, ErrorType } from '../../errors';
import { TFunction } from 'i18next';
import { ObjectType } from '../../types';
import { PromiseDispatch, RootState } from '../../store';

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

interface ChooseaccountProps extends WithStyles<typeof styles> {
  t: TFunction,
  errors: ErrorType,
  hello?: ObjectType | null,
  dispatch: PromiseDispatch,
  history: History,
  loading: string,
}


const Chooseaccount: React.FC<ChooseaccountProps> = ({ t, errors, hello, dispatch, history, loading, classes }) => {

  const logon = (event: React.MouseEvent<HTMLDivElement, MouseEvent> | React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(executeLogonIfFormValid(hello?.username as string, '', true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success as boolean, history));
      }
    });
  }

  const logoff = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    history.push(`/identifier${history.location.search}${history.location.hash}`);
  }


  React.useEffect(() => {
    if ((!hello || !hello.state) && history.action !== 'PUSH') {
      history.replace(`/identifier${history.location.search}${history.location.hash}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  let errorMessage = null;
  if (errors?.http) {
    errorMessage = <Typography color="error" className={classes.message}>
      <ErrorMessage error={errors.http as ErrorType}></ErrorMessage>
    </Typography>;
  }

  let username = '';
  if (hello && hello.state) {
    username = (hello.username as string);
  }

  return (
    <DialogContent className={classes.content}>
      <Typography variant="h5" component="h3">
        {t("konnect.chooseaccount.headline", "Choose an account")}
      </Typography>
      <Typography variant="subtitle1" className={classes.subHeader}>
        {t("konnect.chooseaccount.subHeader", "to sign in")}
      </Typography>

      <form action="" onSubmit={(event) => logon(event)}>
        <List disablePadding className={classes.accountList}>
          <ListItem
            button
            disableGutters
            className={classes.accountListItem}
            disabled={!!loading}
            onClick={(event) => logon(event)}
          ><ListItemAvatar><Avatar>{username.substr(0, 1)}</Avatar></ListItemAvatar>
            <ListItemText primary={username} />
          </ListItem>
          <ListItem
            button
            disableGutters
            className={classes.accountListItem}
            disabled={!!loading}
            onClick={(event) => logoff(event)}
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


const mapStateToProps = (state: RootState) => {
  const { loading, errors } = state.login;
  const { hello } = state.common;

  return {
    loading,
    errors,
    hello: hello as ObjectType
  };
};

export default connect(mapStateToProps)(withStyles(styles)(withTranslation()(Chooseaccount)));
