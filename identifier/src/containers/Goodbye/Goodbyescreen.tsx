import React from 'react';
import { connect } from 'react-redux';

import { withTranslation } from 'react-i18next';

import renderIf from 'render-if';

import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeHello, executeLogoff } from '../../actions/common';
import { PromiseDispatch, RootState } from '../../store';
import { TFunction } from 'i18next';
import { History } from 'history';
import { ObjectType } from '../../types';

const styles = (theme: Theme) => createStyles({
  subHeader: {
    marginBottom: theme.spacing(5)
  },
  wrapper: {
    marginTop: theme.spacing(5),
    position: 'relative',
    display: 'inline-block'
  },
  button: {}
});

interface GoodbyescreenProps extends WithStyles<typeof styles> {
  t: TFunction,
  branding?: { bannerLogo: string, locales: string[] } | null,
  hello?: ObjectType | null,
  dispatch: PromiseDispatch,
  history?: History
}

const Goodbyescreen: React.FC<GoodbyescreenProps> = ({ classes, t, branding, hello, dispatch, history }) => {

  const logoff = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response) => {
      if (response?.success) {
        dispatch(executeHello());
        history?.push('/goodbye');
      }
    });
  }

  React.useEffect(() => {
    dispatch(executeHello());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = hello === null;



  return (
    <ResponsiveScreen loading={loading} branding={branding}>
      {renderIf(hello !== null && !hello?.state)(() => (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.headline", "Goodbye")}
          </Typography>
          <Typography variant="subtitle1" className={classes.subHeader}>
            {t("konnect.goodbye.subHeader", "you have been signed out from your account")}
          </Typography>
          <Typography gutterBottom>
            {t("konnect.goodbye.message.close", "You can close this window now.")}
          </Typography>
        </div>
      ))}
      {renderIf(hello !== null && hello?.state === true)(() => (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.confirm.headline", "Hello {{displayName}}", { displayName: hello?.displayName })}
          </Typography>
          <Typography variant="subtitle1" className={classes.subHeader}>
            {t("konnect.goodbye.confirm.subHeader", "please confirm sign out")}
          </Typography>

          <Typography gutterBottom>
            {t("konnect.goodbye.message.confirm", "Press the button below, to sign out from your account now.")}
          </Typography>

          <DialogActions>
            <div className={classes.wrapper}>
              <Button
                color="secondary"
                variant="outlined"
                className={classes.button}
                onClick={(event) => logoff(event)}
              >
                {t("konnect.goodbye.signoutButton.label", "Sign out")}
              </Button>
            </div>
          </DialogActions>
        </div>
      ))}
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

export default connect(mapStateToProps)(withStyles(styles)(withTranslation()(Goodbyescreen)));
