import React from 'react';
import { withTranslation, Trans } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';

import { TranslationFunction } from '../../types/common';
import { ConsentResponse } from '../../types/actions';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

import {
  Button,
  Tooltip as BaseTooltip,
  CircularProgress,
  Typography,
  DialogActions,
  DialogContent,
} from '@mui/material';
import { green } from '@mui/material/colors';

import { executeConsent, advanceLogonFlow, receiveValidateLogon } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import { REQUEST_CONSENT_ALLOW } from '../../actions/types';
import ClientDisplayName from '../../components/ClientDisplayName';
import ScopesList from '../../components/ScopesList';
import { createHistoryWrapper } from '../../utils/history';

interface ConsentProps {
  t: TranslationFunction;
}

interface TooltipProps {
  children: React.ReactNode;
  title: string;
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'bottom-end' | 'bottom-start' | 'left-end' | 'left-start' | 'right-end' | 'right-start' | 'top-end' | 'top-start';
}

const Tooltip: React.FC<TooltipProps> = ({children, ...other }) => {
  // Ensures that there is only a single child for the tooltip element to
  // make it compatible with the Trans component.
  return <BaseTooltip {...other}><span>{children}</span></BaseTooltip>;
}

const Consent: React.FC<ConsentProps> = ({ t }) => {
  const { loading, hello, errors, client } = useAppSelector((state) => ({
    loading: state.login.loading,
    hello: state.common.hello,
    errors: state.login.errors,
    client: state.common.query?.client_id ? { 
      id: state.common.query.client_id as string, 
      redirect_uri: state.common.query.redirect_uri as string 
    } : null
  }));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!hello || !hello.state || !client) {
      navigate(`/identifier${location.search}${location.hash}`, { replace: true });
    }

    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
  }, [dispatch, hello, navigate, location, client]);

  const action = (allow = false, scopes: Record<string, boolean> = {}) => (event: React.MouseEvent) => {
    event.preventDefault();

    if (allow === undefined) {
      return;
    }

    // Convert all scopes which are true to a scope value.
    const scope = Object.keys(scopes).filter(scope => {
      return !!scopes[scope];
    }).join(' ');

    dispatch(executeConsent(allow, scope)).then((response: ConsentResponse) => {
      if (response.success) {
        const historyWrapper = createHistoryWrapper(navigate, location);
        dispatch(advanceLogonFlow(response.success, historyWrapper, true, {konnect: response.state}));
      }
    });
  };

  if (!hello || !hello.details) {
    return null;
  }

  const scopes = (hello.details.scopes as Record<string, boolean>) || {};
  const meta = (hello.details.meta as { scopes?: { mapping: Record<string, string>, definitions: Record<string, { id: string, description?: string }> } }) || {};

  return (
      <DialogContent>
        <Typography variant="h5" component="h3">
          {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello.displayName })}
        </Typography>
        <Typography variant="subtitle1" sx={{ marginBottom: 2 }}>
          {hello.username}
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          <Trans i18nKey="konnect.consent.message">
            <Tooltip
              placement="bottom"
              title={t("konnect.consent.tooltip.client", 'Clicking "Allow" will redirect you to: {{redirectURI}}', { redirectURI: client?.redirect_uri || '' })}
            >
              <em><ClientDisplayName client={client!}/></em>
            </Tooltip> wants to
          </Trans>
        </Typography>
        <ScopesList dense disablePadding sx={{ marginBottom: 2 }} scopes={scopes} meta={meta.scopes || { mapping: {}, definitions: {} }}></ScopesList>

        <Typography variant="subtitle1" gutterBottom>
          <Trans i18nKey="konnect.consent.question">
            Allow <em><ClientDisplayName client={client!}/></em> to do this?
          </Trans>
        </Typography>
        <Typography color="secondary">
          {t("konnect.consent.consequence", "By clicking Allow, you allow this app to use your information.")}
        </Typography>

        <div>
          <DialogActions>
            <div style={{ marginTop: 16, position: 'relative', display: 'inline-block' }}>
              <Button
                color="secondary"
                variant="outlined"
                sx={{ margin: 1, minWidth: 100 }}
                disabled={!!loading}
                onClick={action(false, scopes)}
              >
                {t("konnect.consent.cancelButton.label", "Cancel")}
              </Button>
              {(loading && loading !== REQUEST_CONSENT_ALLOW) &&
                <CircularProgress size={24} sx={{ color: green[500], position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />}
            </div>
            <div style={{ marginTop: 16, position: 'relative', display: 'inline-block' }}>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                sx={{ margin: 1, minWidth: 100 }}
                disabled={!!loading}
                onClick={action(true, scopes)}
              >
                {t("konnect.consent.allowButton.label", "Allow")}
              </Button>
              {loading === REQUEST_CONSENT_ALLOW && <CircularProgress size={24} sx={{ color: green[500], position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />}
            </div>
          </DialogActions>

          {!!errors.http && (
            <Typography variant="subtitle2" color="error" sx={{ marginTop: 2, marginBottom: 2 }}>
              <ErrorMessage error={errors.http!}></ErrorMessage>
            </Typography>
          )}
        </div>
      </DialogContent>
    );
};

export default withTranslation()(Consent);
