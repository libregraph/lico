import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { useTranslation } from 'react-i18next';

import renderIf from 'render-if';
import { isEmail } from 'validator';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import green from '@material-ui/core/colors/green';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';

import { updateInput, executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment'
import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';

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
    marginBottom: theme.spacing(3)
  },
  wrapper: {
    position: 'relative',
    display: 'inline-block'
  },
  slideContainer: {
    overflowX: 'hidden',
  },
  message: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  usernameInputField: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
});

function Login(props) {
  const {
    hello,
    branding,
    query,
    dispatch,
    history,
    loading,
    errors,
    classes,
    username,
    password,
  } = props;

  const { t } = useTranslation();

  const [showPassword, setShowPassword] = React.useState(false);
  const passwordInputRef = useRef();

  useEffect(() => {
    if (hello && hello.state && history.action !== 'PUSH') {
      if (!query.prompt || query.prompt.indexOf('select_account') === -1) {
        dispatch(advanceLogonFlow(true, history));
        return;
      }

      history.replace(`/chooseaccount${history.location.search}${history.location.hash}`);
      return;
    }

    // If login_hint is an email, set it into the username field automatically.
    if (query && query.login_hint) {
      if (isEmail(query.login_hint) || isEmail(`${query.login_hint}@example.com`)) {
        dispatch(updateInput("username", query.login_hint));
        setTimeout(() => {
          passwordInputRef.current.focus();
        }, 0);
      }
    }
  }, [ /* no dependencies */ ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (name) => (event) => {
    dispatch(updateInput(name, event.target.value));
  };

  const handleNextClick = (event) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(username, password, false)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  };

  const usernamePlaceHolder = useMemo(() => {
    if (branding?.usernameHintText ) {
      switch (branding.usernameHintText) {
        case "Username":
          break;
        case "Email":
          return t("konnect.login.usernameField.placeholder.email", "Email");
        case "Identity":
          return t("konnect.login.usernameField.placeholder.identity", "Identity");
        default:
          return branding.usernameHintText;
      }
    }

    return t("konnect.login.usernameField.placeholder.username", "Username");
  }, [branding, t]);

  return (
    <DialogContent>
      <Typography variant="h5" component="h3" gutterBottom>
        {t("konnect.login.headline", "Sign in")}
      </Typography>

      <form action="" onSubmit={(event) => this.logon(event)}>
        <TextField
          label={usernamePlaceHolder}
          error={!!errors.username}
          helperText={<ErrorMessage error={errors.username} values={{what: usernamePlaceHolder}}></ErrorMessage>}
          fullWidth
          autoFocus
          inputProps={{
            autoCapitalize: 'off',
            spellCheck: 'false'
          }}
          value={username}
          onChange={handleChange('username')}
          autoComplete="kopano-account username"
          variant="outlined"
          className={classes.usernameInputField}
        />
        <TextField
          inputRef={passwordInputRef}
          type={showPassword ? "text" : "password"}
          label={t("konnect.login.passwordField.label", "Password")}
          error={!!errors.password}
          helperText={<ErrorMessage error={errors.password}></ErrorMessage>}
          fullWidth
          onChange={handleChange('password')}
          autoComplete="kopano-account current-password"
          variant="outlined"
          InputProps={{      // End-adornment icon to show/hide password on visibility button click.
            endAdornment: <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={() => setShowPassword((show) => !show)}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          }}
        />
        <DialogActions>
          <div className={classes.wrapper}>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.button}
              disabled={!!loading}
              onClick={handleNextClick}
            >
              {t("konnect.login.nextButton.label", "Next")}
            </Button>
            {loading && <CircularProgress size={24} className={classes.buttonProgress} />}
          </div>
        </DialogActions>

        {renderIf(errors.http)(() => (
          <Typography variant="subtitle2" color="error" className={classes.message}>
            <ErrorMessage error={errors.http}></ErrorMessage>
          </Typography>
        ))}

        {branding?.signinPageText && <Typography variant="body2">{branding.signinPageText}</Typography>}
      </form>
    </DialogContent>
  );
}

Login.propTypes = {
  classes: PropTypes.object.isRequired,

  loading: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  password: PropTypes.string.isRequired,
  errors: PropTypes.object.isRequired,
  branding: PropTypes.object,
  hello: PropTypes.object,
  query: PropTypes.object.isRequired,

  dispatch: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired
};

const mapStateToProps = (state) => {
  const { loading, username, password, errors} = state.login;
  const { branding, hello, query } = state.common;

  return {
    loading,
    username,
    password,
    errors,
    branding,
    hello,
    query
  };
};

export default connect(mapStateToProps)(withStyles(styles)(Login));
