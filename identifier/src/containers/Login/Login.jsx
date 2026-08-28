import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { useTranslation } from 'react-i18next';

// The ESM build, imported by module path. The package root is a CommonJS barrel
// whose default export is one object literal holding every validator, so nothing
// can be shaken out of it and the whole library ships: 122 KB to answer one
// question. This path is the same source compiled to ESM and reaches six
// modules, which is why it costs about 5 KB instead. Aliasing the root to the
// ESM build does not help, because that object literal is still what it exports.
import isEmail from 'validator/es/lib/isEmail';

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

/*
 * login_hint decides only whether the username field is prefilled. The server
 * remains the authority on what is a valid identity.
 *
 * A hint may be a whole address or just the local part of one, so the local part
 * is recognised by testing it against a placeholder domain.
 */
function looksLikeIdentity(hint) {
  return isEmail(hint) || isEmail(`${hint}@example.com`);
}

/*
 * A user may type an internationalised domain, and one may arrive in login_hint.
 * The field keeps whatever was typed, but the domain is encoded to ASCII before
 * the username goes on the wire, because the backends behind this expect a
 * domain in its IDNA form. The local part is left alone: punycode applies to
 * domain labels only, and a UTF-8 local part was already submitted verbatim.
 *
 * The URL parser does the encoding, which is the platform's own IDNA
 * implementation, so there is nothing to install and nothing to keep current.
 * The split has to come first: new URL('http://user@host') would read the whole
 * thing as userinfo plus host and hand back only the host.
 */
function withAsciiDomain(username) {
  const at = username.lastIndexOf('@');
  if (at === -1) {
    return username;
  }

  const local = username.slice(0, at);
  const domain = username.slice(at + 1);
  try {
    const { hostname } = new URL(`http://${domain}`);
    return hostname ? `${local}@${hostname}` : username;
  } catch {
    // Not a domain the parser accepts. Send it as typed and let the server say so.
    return username;
  }
}

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

  // This effect decides once, on mount, whether an already signed-in visitor
  // should be redirected onwards and whether login_hint should prefill the
  // username. Naming its dependencies would re-run both on every change to the
  // query, the history or the store, which would fight the user as they type.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if (hello?.state && history.action !== 'PUSH') {
      if (!query.prompt || query.prompt.indexOf('select_account') === -1) {
        dispatch(advanceLogonFlow(true, history));
        return;
      }

      history.replace(`/chooseaccount${history.location.search}${history.location.hash}`);
      return;
    }

    // Prefill the username from login_hint when it looks like an identity.
    if (query?.login_hint && looksLikeIdentity(query.login_hint)) {
      dispatch(updateInput("username", query.login_hint));

      // Move focus on to the password once the field above has its value. The
      // timer is cleared on unmount, because otherwise the callback runs against
      // a component which has already gone and the ref is null by then.
      const focusPassword = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 0);

      return () => clearTimeout(focusPassword);
    }
  }, []);

  const handleChange = (name) => (event) => {
    dispatch(updateInput(name, event.target.value));
  };

  const handleNextClick = (event) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(withAsciiDomain(username), password, false)).then((response) => {
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

      <form action="" onSubmit={handleNextClick}>
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

        {errors.http && (
          <Typography variant="subtitle2" color="error" className={classes.message}>
            <ErrorMessage error={errors.http}></ErrorMessage>
          </Typography>
        )}

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
