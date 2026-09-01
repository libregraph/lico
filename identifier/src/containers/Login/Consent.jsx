import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import { Trans, useTranslation } from 'react-i18next';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import BaseTooltip from '@material-ui/core/Tooltip';
import CircularProgress from '@material-ui/core/CircularProgress';
import green from '@material-ui/core/colors/green';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';

import { executeConsent, advanceLogonFlow, receiveValidateLogon } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import { REQUEST_CONSENT_ALLOW } from '../../actions/types';
import ClientDisplayName from '../../components/ClientDisplayName';
import ScopesList from '../../components/ScopesList';

const styles = theme => ({
  button: {
    margin: theme.spacing(1),
    minWidth: 100
  },
  buttonProgress: {
    color: green[500],
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12
  },
  subHeader: {
    marginBottom: theme.spacing(2)
  },
  scopesList: {
    marginBottom: theme.spacing(2)
  },
  wrapper: {
    marginTop: theme.spacing(2),
    position: 'relative',
    display: 'inline-block'
  },
  message: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  }
});

const Tooltip = ({children, ...other } = {}) => {
  // Ensures that there is only a single child for the tooltip element to
  // make it compatible with the Trans component.
  return <BaseTooltip {...other}><span>{children}</span></BaseTooltip>;
}

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
}

function Consent(props) {
  const { classes, history } = props;

  const { t } = useTranslation();

  const dispatch = useDispatch();
  const hello = useSelector(state => state.common.hello);
  const loading = useSelector(state => state.login.loading);
  const errors = useSelector(state => state.login.errors);

  // No session means no client, and the mount guard tests for exactly that, so
  // it must not be given an empty object which would read as one being present.
  const client = hello?.details ? hello.details.client : undefined;

  // The guard runs once, on mount. Naming hello or client as dependencies would
  // re-run it whenever the session changes and could redirect the visitor away
  // in the middle of deciding.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if ((!hello?.state || !client) && history.action !== 'PUSH') {
      history.replace(`/identifier${history.location.search}${history.location.hash}`);
    }

    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
  }, []);

  // No default for allow: the form passes it undefined to mean "decide nothing",
  // and a default would turn that into an explicit refusal.
  const action = (allow, scopes={}) => (event) => {
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
  const meta = hello.details.meta || {};

  return (
    <DialogContent>
      <Typography variant="h5" component="h3">
        {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello.displayName })}
      </Typography>
      <Typography variant="subtitle1" className={classes.subHeader}>
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
      <ScopesList dense disablePadding className={classes.scopesList} scopes={scopes} meta={meta.scopes || {}}></ScopesList>

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
          <div className={classes.wrapper}>
            <Button
              color="secondary"
              variant="outlined"
              className={classes.button}
              disabled={!!loading}
              onClick={action(false, scopes)}
            >
              {t("konnect.consent.cancelButton.label", "Cancel")}
            </Button>
            {(loading && loading !== REQUEST_CONSENT_ALLOW) &&
              <CircularProgress size={24} className={classes.buttonProgress} />}
          </div>
          <div className={classes.wrapper}>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.button}
              disabled={!!loading}
              onClick={action(true, scopes)}
            >
              {t("konnect.consent.allowButton.label", "Allow")}
            </Button>
            {loading === REQUEST_CONSENT_ALLOW && <CircularProgress size={24} className={classes.buttonProgress} />}
          </div>
        </DialogActions>

        {errors.http && (
          <Typography variant="subtitle2" color="error" className={classes.message}>
            <ErrorMessage error={errors.http}></ErrorMessage>
          </Typography>
        )}
      </form>
    </DialogContent>
  );
}

Consent.propTypes = {
  classes: PropTypes.object.isRequired,

  history: PropTypes.object.isRequired
};

export default withStyles(styles)(Consent);
