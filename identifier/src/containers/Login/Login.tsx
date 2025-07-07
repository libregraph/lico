import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogonResponse } from '../../types/actions';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

import { useTranslation } from 'react-i18next';

import { isEmail } from 'validator';

import {
  Button,
  CircularProgress,
  TextField,
  Typography,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { green } from '@mui/material/colors';

import { updateInput, executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { createHistoryWrapper } from '../../utils/history';

interface LoginProps {}

function Login(props: LoginProps) {
  const {
    hello,
    branding,
    query,
    loading,
    errors,
    username,
    password
  } = useAppSelector((state) => ({
    hello: state.common.hello,
    branding: state.common.branding,
    query: state.common.query,
    loading: state.login.loading,
    errors: state.login.errors,
    username: state.login.username,
    password: state.login.password
  }));
  
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { t } = useTranslation();

  const [showPassword, setShowPassword] = React.useState(false);
  const passwordInputRef = useRef<HTMLInputElement>();

  useEffect(() => {
    if (hello && hello.state) {
      if (!query?.prompt || (typeof query.prompt === 'string' && query.prompt.indexOf('select_account') === -1)) {
        const historyWrapper = createHistoryWrapper(navigate, location);
        dispatch(advanceLogonFlow(true, historyWrapper));
        return;
      }

      navigate(`/chooseaccount${location.search}${location.hash}`, { replace: true });
      return;
    }

    // If login_hint is an email, set it into the username field automatically.
    if (query && query.login_hint) {
      if (typeof query.login_hint === 'string' && (isEmail(query.login_hint) || isEmail(`${query.login_hint}@example.com`))) {
        dispatch(updateInput("username", query.login_hint));
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 0);
      }
    }
  }, [ /* no dependencies */ ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateInput(name, event.target.value));
  };

  const handleNextClick = (event: React.MouseEvent) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(username, password, false)).then((response: LogonResponse) => {
      if (response.success) {
        const historyWrapper = createHistoryWrapper(navigate, location);
        dispatch(advanceLogonFlow(response.success, historyWrapper));
      }
    });
  };

  const usernamePlaceHolder = useMemo(() => {
    if (branding?.usernameHintText && typeof branding.usernameHintText === 'string') {
      switch (branding.usernameHintText) {
        case "Username":
          return t("konnect.login.usernameField.placeholder.username", "Username");
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

      <div>
        <TextField
          label={usernamePlaceHolder}
          error={!!errors.username}
          helperText={errors.username ? <ErrorMessage error={errors.username} values={{what: usernamePlaceHolder}} /> : undefined}
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
          sx={{ marginTop: 1, marginBottom: 1.5 }}
        />
        <TextField
          inputRef={passwordInputRef}
          type={showPassword ? "text" : "password"}
          label={t("konnect.login.passwordField.label", "Password")}
          error={!!errors.password}
          helperText={errors.password ? <ErrorMessage error={errors.password} /> : undefined}
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
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              sx={{ margin: 1, minWidth: 100 }}
              disabled={!!loading}
              onClick={handleNextClick}
            >
              {t("konnect.login.nextButton.label", "Next")}
            </Button>
            {loading && <CircularProgress size={24} sx={{ color: green[500], position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />}
          </div>
        </DialogActions>

        {!!errors.http && (
          <Typography variant="subtitle2" color="error" sx={{ marginTop: 2, marginBottom: 2 }}>
            <ErrorMessage error={errors.http!}></ErrorMessage>
          </Typography>
        )}

        {branding?.signinPageText && typeof branding.signinPageText === 'string' && <Typography variant="body2">{branding.signinPageText as string}</Typography>}
      </div>
    </DialogContent>
  );
}

export default Login;
