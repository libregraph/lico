import React from 'react';
import { withTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Typography,
  DialogActions,
} from '@mui/material';

import { TranslationFunction } from '../../types/common';
import { ActionResponse } from '../../types/actions';
import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeLogoff } from '../../actions/common';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

interface WelcomescreenProps {
  t: TranslationFunction;
}

const Welcomescreen: React.FC<WelcomescreenProps> = ({ t }) => {
  const { branding, hello } = useAppSelector((state) => ({
    branding: state.common.branding,
    hello: state.common.hello
  }));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const logoff = (event: React.MouseEvent) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response: ActionResponse) => {
      if (response.success) {
        navigate('/identifier');
      }
    });
  };

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding || undefined}>
      <Typography variant="h5" component="h3">
        {t("konnect.welcome.headline", "Welcome {{displayName}}", {displayName: hello?.displayName})}
      </Typography>
      <Typography variant="subtitle1" sx={{ marginBottom: 5 }}>
        {hello?.username}
      </Typography>

      <Typography gutterBottom>
        {t("konnect.welcome.message", "You are signed in - awesome!")}
      </Typography>

      <DialogActions>
        <Button
          color="secondary"
          sx={{ margin: 1, minWidth: 100 }}
          variant="contained"
          onClick={logoff}
        >
          {t("konnect.welcome.signoutButton.label", "Sign out")}
        </Button>
      </DialogActions>
    </ResponsiveScreen>
  );
};

export default withTranslation()(Welcomescreen);
