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
import renderIf from 'render-if';

import { retryHello } from '../actions/common';
import { ErrorMessage } from '../errors';

interface LoadingProps {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
}

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
        sx={{
          flexGrow: 1,
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }}
      >
        <Grid item sx={{ textAlign: 'center' }}>
          {renderIf(error === null)(() => (
            <LinearProgress sx={{ height: '4px', width: '100px' }} />
          ))}
          {renderIf(error !== null)(() => (
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
                sx={{ marginTop: 5 }}
                onClick={retry}
              >
                {t("konnect.login.retryButton.label", "Retry")}
              </Button>
            </Box>
          ))}
        </Grid>
      </Grid>
  );
};

export default withTranslation()(Loading);
