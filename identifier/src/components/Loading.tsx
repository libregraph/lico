import type React from 'react';

import { useTranslation } from 'react-i18next';

import LinearProgress from '@mui/material/LinearProgress';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

import { retryHello } from '../actions/common';
import { ErrorMessage } from '../errors';
import { useAppDispatch, useAppSelector } from '../hooks/redux';

/*
 * Grid's root is a div, and React's div typings dropped the deprecated align
 * attribute, so it cannot be written inline. It still reaches the DOM.
 */
const legacyAlign = { align: 'center' };

function Loading() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const error = useAppSelector(state => state.common.error);

  const handleRetry = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(retryHello());
  };

  return (
    <Grid
      container
      spacing={0}
      sx={{
        flexGrow: 1,
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Grid {...legacyAlign}>
        {error === null ? (
          <LinearProgress sx={{ height: '4px', width: '100px' }} />
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
              sx={{ mt: 5 }}
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

export default Loading;
