import { useEffect } from 'react';
import type { History } from 'history';

import { useTranslation } from 'react-i18next';

import { createStyles, withStyles } from '@material-ui/core/styles';
import type { Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeHello, executeLogoff } from '../../actions/common';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';

const styles = (theme: Theme) => createStyles({
  subHeader: {
    marginBottom: theme.spacing(5)
  },
  wrapper: {
    marginTop: theme.spacing(5),
    position: 'relative',
    display: 'inline-block'
  }
});

export interface GoodbyescreenProps {
  classes: { subHeader: string; wrapper: string };
  // Supplied by the Route which renders this screen.
  history: History;
}

function Goodbyescreen(props: GoodbyescreenProps) {
  const { classes, history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const branding = useAppSelector(state => state.common.branding);
  const hello = useAppSelector(state => state.common.hello);

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
        history.push('/goodbye');
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
          <Typography variant="subtitle1" className={classes.subHeader}>
            {t("konnect.goodbye.subHeader", "you have been signed out from your account")}
          </Typography>
          <Typography gutterBottom>
            {t("konnect.goodbye.message.close", "You can close this window now.")}
          </Typography>
        </div>
      )}
      {hello !== null && hello.state === true && (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.confirm.headline", "Hello {{displayName}}", { displayName: hello.displayName })}
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
                onClick={handleLogoff}
              >
                {t("konnect.goodbye.signoutButton.label", "Sign out")}
              </Button>
            </div>
          </DialogActions>
        </div>
      )}
    </ResponsiveScreen>
  );
}

export default withStyles(styles)(Goodbyescreen);
