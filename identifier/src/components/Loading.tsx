import React from 'react';
import { connect } from 'react-redux';

import { withTranslation } from 'react-i18next';

import { createStyles, Theme, withStyles } from '@material-ui/core/styles';
import LinearProgress from '@material-ui/core/LinearProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import renderIf from 'render-if';

import { retryHello } from '../actions/common';
import { ErrorMessage, ErrorType } from '../errors';
import { PromiseDispatch, RootState } from '../store';
import { TFunction } from 'i18next';
import { WithStyles } from '@material-ui/styles';

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

interface LoadingProps extends WithStyles<typeof styles> {
  error: ErrorType, t: TFunction, dispatch: PromiseDispatch
}

const Loading = ({ classes, error, t, dispatch }: LoadingProps): JSX.Element => {

  const retry = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    dispatch(retryHello());
  }

  return (
    <Grid container direction="column" alignItems="center" justifyContent="center" spacing={0} className={classes.root}>
      <Grid item alignItems="center">
        {renderIf(error === null)(() => (
          <LinearProgress className={classes.progress} />
        ))}
        {renderIf(error !== null)(() => (
          <div>
            <Typography variant="h5" gutterBottom align="center">
              {t("konnect.loading.error.headline", "Failed to connect to server")}
            </Typography>
            <Typography gutterBottom align="center" color="error">
              <ErrorMessage error={error as ErrorType}></ErrorMessage>
            </Typography>
            <Button
              autoFocus
              color="primary"
              variant="outlined"
              className={classes.button}
              onClick={(event) => retry(event)}
            >
              {t("konnect.login.retryButton.label", "Retry")}
            </Button>
          </div>
        ))}
      </Grid>
    </Grid>
  );
}

const mapStateToProps = (state: RootState) => {
  const { error } = state.common;

  return {
    error
  };
};

export default connect(mapStateToProps)(withTranslation()(withStyles(styles)(Loading)));
