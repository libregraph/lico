import type React from 'react';

import { useTranslation } from 'react-i18next';

import { createStyles, withStyles } from '@material-ui/core/styles';
import type { Theme } from '@material-ui/core/styles';
import LinearProgress from '@material-ui/core/LinearProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import { retryHello } from '../actions/common';
import { ErrorMessage } from '../errors';
import { useAppDispatch, useAppSelector } from '../hooks/redux';

const styles = (theme: Theme) => createStyles({
  root: {
    flexGrow: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  },
  progress: {
    height: '4px',
    width: '100px'
  },
  button: {
    marginTop: theme.spacing(5)
  }
});

/*
 * Grid's root is a div, and React's div typings dropped the deprecated align
 * attribute, so it cannot be written inline. It still reaches the DOM.
 */
const legacyAlign = { align: 'center' };

export interface LoadingProps {
  classes: {
    root: string;
    progress: string;
    button: string;
  };
}

function Loading(props: LoadingProps) {
  const { classes } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const error = useAppSelector(state => state.common.error);

  const handleRetry = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(retryHello());
  };

  return (
    <Grid container direction="column" alignItems="center" justifyContent="center" spacing={0} className={classes.root}>
      <Grid item {...legacyAlign}>
        {error === null ? (
          <LinearProgress className={classes.progress} />
        ) : (
          <div>
            <Typography variant="h5" gutterBottom align="center">
              {t("konnect.loading.error.headline", "Failed to connect to server")}
            </Typography>
            <Typography  gutterBottom align="center" color="error">
              <ErrorMessage error={error}></ErrorMessage>
            </Typography>
            <Button
              autoFocus
              color="primary"
              variant="outlined"
              className={classes.button}
              onClick={handleRetry}
            >
              {t("konnect.login.retryButton.label", "Retry")}
            </Button>
          </div>
        )}
      </Grid>
    </Grid>
  );
}

export default withStyles(styles)(Loading);
