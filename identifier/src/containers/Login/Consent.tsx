import React, { ReactNode } from 'react';
import { connect } from 'react-redux';

import { withTranslation, Trans } from 'react-i18next';

import renderIf from 'render-if';

import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import BaseTooltip, { TooltipProps } from '@material-ui/core/Tooltip';
import CircularProgress from '@material-ui/core/CircularProgress';
import green from '@material-ui/core/colors/green';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';

import { executeConsent, advanceLogonFlow, receiveValidateLogon } from '../../actions/login';
import { ErrorMessage, ErrorType } from '../../errors';
import { REQUEST_CONSENT_ALLOW } from '../../actions/types';
import ClientDisplayName from '../../components/ClientDisplayName';
import ScopesList from '../../components/ScopesList';
import { PromiseDispatch, RootState } from '../../store';
import { MappingType, ObjectType } from '../../types';
import { TFunction } from 'i18next';
import { History } from 'history';

const styles = (theme: Theme) => createStyles({
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

const Tooltip: React.FC<{ children: ReactNode } & TooltipProps> = ({ children, ...other }) => {
  // Ensures that there is only a single child for the tooltip element to
  // make it compatible with the Trans component.
  return <BaseTooltip {...other}><span>{children}</span></BaseTooltip>;
}


interface ConsentProps extends WithStyles<typeof styles> {
  t: TFunction
  hello?: ObjectType | null,
  dispatch: PromiseDispatch,
  history?: History,
  loading: string,
  errors: ErrorType,
  client: { [key: string]: string }
}

const Consent: React.FC<ConsentProps> = ({ t, hello, dispatch, history, loading, errors, client, classes }) => {

  React.useEffect(() => {
    if ((!hello || !hello.state || !client) && history?.action !== 'PUSH') {
      history?.replace(`/identifier${history?.location?.search}${history?.location?.hash}`);
    }
    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const action = (allow = false, scopes: ObjectType = {}) => (event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined) => {
    event?.preventDefault();

    if (allow === undefined) {
      return;
    }

    // Convert all scopes which are true to a scope value.
    const scope = Object.keys(scopes).filter(scope => {
      return !!scopes[scope];
    }).join(' ');

    dispatch(executeConsent(allow, scope)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success as boolean, history, true, { konnect: (response as ObjectType).state }));
      }
    });
  }



  const scopes = (hello?.details as ObjectType)?.scopes || {};
  const meta = (hello?.details as ObjectType)?.meta as { scopes: MappingType } || {};

  return (
    <DialogContent>
      <Typography variant="h5" component="h3">
        {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello?.displayName })}
      </Typography>
      <Typography variant="subtitle1" className={classes.subHeader}>
        {hello?.username}
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        <Trans t={t} i18nKey="konnect.consent.message">
          <Tooltip
            placement="bottom"
            title={t("konnect.consent.tooltip.client", 'Clicking "Allow" will redirect you to: {{redirectURI}}', { redirectURI: client.redirect_uri }) as string}
          >
            <em><ClientDisplayName client={client} /></em>
          </Tooltip> wants to
        </Trans>
      </Typography>
      <ScopesList dense disablePadding className={classes.scopesList} scopes={scopes as string[]} meta={meta.scopes as MappingType}></ScopesList>

      <Typography variant="subtitle1" gutterBottom>
        <Trans t={t} i18nKey="konnect.consent.question">
          Allow <em><ClientDisplayName client={client} /></em> to do this?
        </Trans>
      </Typography>
      <Typography color="secondary">
        {t("konnect.consent.consequence", "By clicking Allow, you allow this app to use your information.")}
      </Typography>

      <form action="" onSubmit={(event) => action(undefined, scopes as ObjectType)}>
        <DialogActions>
          <div className={classes.wrapper}>
            <Button
              color="secondary"
              variant="outlined"
              className={classes.button}
              disabled={!!loading}
              onClick={(event) => action(false, scopes as ObjectType)}
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
              onClick={action(true, scopes as MappingType)}
            >
              {t("konnect.consent.allowButton.label", "Allow")}
            </Button>
            {loading === REQUEST_CONSENT_ALLOW && <CircularProgress size={24} className={classes.buttonProgress} />}
          </div>
        </DialogActions>

        {renderIf(errors?.http)(() => (
          <Typography variant="subtitle2" color="error" className={classes.message}>
            <ErrorMessage error={errors?.http as ErrorType}></ErrorMessage>
          </Typography>
        ))}
      </form>
    </DialogContent>
  );
}

const mapStateToProps = (state: RootState) => {
  const { hello } = state.common;
  const { loading, errors } = state.login;

  return {
    loading: loading,
    errors,
    hello: hello as ObjectType,
    client: (hello?.details as ObjectType)?.client as { [key: string]: string } || {}
  };
};

export default connect(mapStateToProps)(withStyles(styles)(withTranslation()(Consent)));
