import React, { useEffect } from 'react';
import { withTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import renderIf from 'render-if';
import {
  Button,
  Typography,
  DialogActions,
} from '@mui/material';

import { TranslationFunction } from '../../types/common';
import { ActionResponse } from '../../types/actions';
import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeHello, executeLogoff } from '../../actions/common';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

interface GoodbyescreenProps {
  t: TranslationFunction;
}

const Goodbyescreen: React.FC<GoodbyescreenProps> = ({ t }) => {
  const { branding, hello } = useAppSelector((state) => ({
    branding: state.common.branding,
    hello: state.common.hello
  }));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(executeHello());
  }, [dispatch]);

  const logoff = (event: React.MouseEvent) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response: ActionResponse) => {
      if (response.success) {
        dispatch(executeHello());
        navigate('/goodbye');
      }
    });
  };

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding}>
      {renderIf(hello !== null && !hello.state)(() => (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.headline", "Goodbye")}
          </Typography>
          <Typography variant="subtitle1" sx={{ marginBottom: 5 }}>
            {t("konnect.goodbye.subHeader", "you have been signed out from your account")}
          </Typography>
          <Typography gutterBottom>
            {t("konnect.goodbye.message.close", "You can close this window now.")}
          </Typography>
        </div>
      ))}
      {renderIf(hello !== null && hello.state === true)(() => (
        <div>
          <Typography variant="h5" component="h3">
            {t("konnect.goodbye.confirm.headline", "Hello {{displayName}}", { displayName: hello?.displayName })}
          </Typography>
          <Typography variant="subtitle1" sx={{ marginBottom: 5 }}>
            {t("konnect.goodbye.confirm.subHeader", "please confirm sign out")}
          </Typography>

          <Typography gutterBottom>
            {t("konnect.goodbye.message.confirm", "Press the button below, to sign out from your account now.")}
          </Typography>

          <DialogActions>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Button
                color="secondary"
                variant="outlined"
                sx={{ margin: 1, minWidth: 100 }}
                onClick={logoff}
              >
                {t("konnect.goodbye.signoutButton.label", "Sign out")}
              </Button>
            </div>
          </DialogActions>
        </div>
      ))}
    </ResponsiveScreen>
  );
};

export default withTranslation()(Goodbyescreen);