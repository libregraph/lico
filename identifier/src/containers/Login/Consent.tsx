import { useEffect } from 'react';
import type { History } from 'history';

import { Trans, useTranslation } from 'react-i18next';

import type { SxProps, Theme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import BaseTooltip from '@mui/material/Tooltip';
import type { TooltipProps as BaseTooltipProps } from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { executeConsent, advanceLogonFlow, receiveValidateLogon } from '../../actions/login';

import { ErrorMessage } from '../../errors';
import { REQUEST_CONSENT_ALLOW } from '../../actions/types';
import ClientDisplayName from '../../components/ClientDisplayName';
import ScopesList from '../../components/ScopesList';
import { withSearchAndHash } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { green } from '@mui/material/colors';

// Both action buttons share the same wrapper, which positions the progress
// indicator over them.
const wrapperSx: SxProps<Theme> = {
  mt: 2,
  position: 'relative',
  display: 'inline-block'
};

// The negative offsets centre the 24px indicator on the button. In spacing
// units -1.5 is the former -12px.
const buttonProgressSx: SxProps<Theme> = {
  color: green[500],
  position: 'absolute',
  top: '50%',
  left: '50%',
  mt: -1.5,
  ml: -1.5
};

/*
 * The base tooltip takes a single element, which is exactly what this wrapper
 * guarantees. Its own children are widened to any node so the Trans component
 * can hand it whatever the translation interpolates.
 */
interface TooltipProps extends Omit<BaseTooltipProps, 'children'> {
  children: React.ReactNode;
}

const Tooltip = ({ children, ...other }: TooltipProps) => {
  // Ensures that there is only a single child for the tooltip element to
  // make it compatible with the Trans component.
  return <BaseTooltip {...other}><span>{children}</span></BaseTooltip>;
}

export interface ConsentProps {
  // Supplied by the Route which renders this screen.
  history: History;
}

function Consent(props: ConsentProps) {
  const { history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const hello = useAppSelector(state => state.common.hello);
  const loading = useAppSelector(state => state.login.loading);
  const errors = useAppSelector(state => state.login.errors);

  // No session means no client, and the mount guard tests for exactly that, so
  // it must not be given an empty object which would read as one being present.
  const client = hello?.details ? hello.details.client : undefined;

  // The guard runs once, on mount. Naming hello or client as dependencies would
  // re-run it whenever the session changes and could redirect the visitor away
  // in the middle of deciding.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if ((!hello?.state || !client) && history.action !== 'PUSH') {
      history.replace(withSearchAndHash('/identifier', history.location));
    }

    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
  }, []);

  // No default for allow: the form passes it undefined to mean "decide nothing",
  // and a default would turn that into an explicit refusal.
  const action = (allow: boolean | undefined, scopes: Record<string, boolean> = {}) =>
    (event: React.SyntheticEvent) => {
      event.preventDefault();

      if (allow === undefined) {
        return;
      }

      // Convert all scopes which are true to a scope value.
      const scope = Object.keys(scopes).filter(scope => {
        return !!scopes[scope];
      }).join(' ');

      dispatch(executeConsent(allow, scope)).then((response) => {
        if (response.success) {
          dispatch(advanceLogonFlow(response.success, history, true, {konnect: response.state}));
        }
      });
    };

  // The mount guard sends the visitor away when there is nothing to consent
  // to, but that only happens after this first render, and it deliberately
  // stays put when the application itself navigated here.
  if (!hello?.details || !client) {
    return null;
  }

  const scopes = hello.details.scopes || {};

  // A reply always describes its scopes. An empty description still has to name
  // both members, because the list looks up every scope in the mapping.
  const meta = hello.details.meta?.scopes ?? { mapping: {}, definitions: {} };

  return (
    <DialogContent>
      <Typography variant="h5" component="h3">
        {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello.displayName })}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {hello.username}
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        <Trans t={t} i18nKey="konnect.consent.message">
          <Tooltip
            placement="bottom"
            title={t("konnect.consent.tooltip.client", 'Clicking "Allow" will redirect you to: {{redirectURI}}', { redirectURI: client.redirect_uri })}
          >
            <em><ClientDisplayName client={client}/></em>
          </Tooltip> wants to
        </Trans>
      </Typography>
      <ScopesList dense disablePadding sx={{ mb: 2 }} scopes={scopes} meta={meta}></ScopesList>

      <Typography variant="subtitle1" gutterBottom>
        <Trans t={t} i18nKey="konnect.consent.question">
          Allow <em><ClientDisplayName client={client}/></em> to do this?
        </Trans>
      </Typography>
      <Typography color="secondary">
        {t("konnect.consent.consequence", "By clicking Allow, you allow this app to use your information.")}
      </Typography>

      <form action="" onSubmit={action(undefined, scopes)}>
        <DialogActions>
          <Box sx={wrapperSx}>
            <Button
              color="secondary"
              variant="outlined"
              sx={{ m: 1, minWidth: 100 }}
              disabled={!!loading}
              onClick={action(false, scopes)}
            >
              {t("konnect.consent.cancelButton.label", "Cancel")}
            </Button>
            {(loading && loading !== REQUEST_CONSENT_ALLOW) &&
              <CircularProgress size={24} sx={buttonProgressSx} />}
          </Box>
          <Box sx={wrapperSx}>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              sx={{ m: 1, minWidth: 100 }}
              disabled={!!loading}
              onClick={action(true, scopes)}
            >
              {t("konnect.consent.allowButton.label", "Allow")}
            </Button>
            {loading === REQUEST_CONSENT_ALLOW && <CircularProgress size={24} sx={buttonProgressSx} />}
          </Box>
        </DialogActions>

        {errors.http && (
          <Typography variant="subtitle2" color="error" sx={{ mt: 2, mb: 2 }}>
            <ErrorMessage error={errors.http}></ErrorMessage>
          </Typography>
        )}
      </form>
    </DialogContent>
  );
}

export default Consent;
