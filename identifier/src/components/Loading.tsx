import React from 'react';
import { withTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import {
  LinearProgress,
  Grid,
  Typography,
  Button,
  Box,
} from '@mui/material';

import { retryHello } from '../actions/common';
import { ErrorMessage } from '../errors';

interface LoadingProps {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
}

const containerStyles = {
  flexGrow: 1,
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const retryButtonStyles = {
  marginTop: 5,
};

const Loading: React.FC<LoadingProps> = ({ t }) => {
  const error = useAppSelector((state) => state.common.error);
  const dispatch = useAppDispatch();

  const retry = (event: React.MouseEvent) => {
    event.preventDefault();
    dispatch(retryHello());
  };

  return (
      <Grid 
        container 
        direction="column" 
        alignItems="center" 
        justifyContent="center" 
        spacing={0}
        sx={containerStyles}
      >
        <Grid item sx={{ textAlign: 'center' }}>
          {error === null ? (
            <LinearProgress sx={{ height: '4px', width: '100px' }} />
          ) : (
            <Box>
              <Typography variant="h5" gutterBottom align="center">
                {t("konnect.loading.error.headline", "Failed to connect to server")}
              </Typography>
              <Typography gutterBottom align="center" color="error">
                <ErrorMessage error={error}></ErrorMessage>
              </Typography>
              <Button
                autoFocus
                color="primary"
                variant="outlined"
                sx={retryButtonStyles}
                onClick={retry}
                aria-label={t("konnect.login.retryButton.label", "Retry")}
              >
                {t("konnect.login.retryButton.label", "Retry")}
              </Button>
            </Box>
          )}
        </Grid>
      </Grid>
  );
};

export default withTranslation()(Loading);
