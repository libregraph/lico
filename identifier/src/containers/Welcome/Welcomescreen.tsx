import React from 'react';
import { connect } from 'react-redux';
import { History } from 'history';

import { withTranslation } from 'react-i18next';

import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeLogoff } from '../../actions/common';
import { PromiseDispatch, RootState } from '../../store';
import { ObjectType } from '../../types';
import { TFunction } from 'i18next';

const styles = (theme: Theme) => createStyles({
  button: {
    margin: theme.spacing(1),
    minWidth: 100
  },
  subHeader: {
    marginBottom: theme.spacing(5)
  }
});


interface WelcomescreenProps extends WithStyles<typeof styles> {
  t: TFunction,
  branding?: { bannerLogo: string, locales: string[] } | null,
  hello?: ObjectType | null,
  dispatch: PromiseDispatch,
  history?: History
}

const Welcomescreen: React.FC<WelcomescreenProps> = ({ t, classes, branding, hello, dispatch, history }) => {

  const loading = hello === null;

  const logoff = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response) => {

      if (response?.success) {
        history?.push('/identifier');
      }
    });
  }

  return (
    <ResponsiveScreen loading={loading} branding={branding}>
      <Typography variant="h5" component="h3">
        {t("konnect.welcome.headline", "Welcome {{displayName}}", { displayName: hello?.displayName })}
      </Typography>
      <Typography variant="subtitle1" className={classes.subHeader}>
        {hello?.username}
      </Typography>

      <Typography gutterBottom>
        {t("konnect.welcome.message", "You are signed in - awesome!")}
      </Typography>

      <DialogActions>
        <Button
          color="secondary"
          className={classes.button}
          variant="contained"
          onClick={(event) => logoff(event)}
        >
          {t("konnect.welcome.signoutButton.label", "Sign out")}
        </Button>
      </DialogActions>
    </ResponsiveScreen>
  );
}


const mapStateToProps = (state: RootState) => {
  const { branding, hello } = state.common;

  return {
    branding,
    hello: hello as ObjectType
  };
};

export default connect(mapStateToProps)(withStyles(styles)(withTranslation()(Welcomescreen)));
