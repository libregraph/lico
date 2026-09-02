import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { History } from "history";
// The ESM build, imported by module path. The package root is a CommonJS barrel
// whose default export is one object literal holding every validator, so nothing
// can be shaken out of it and the whole library ships: 122 KB to answer one
// question. This path is the same source compiled to ESM and reaches six
// modules, which is why it costs about 5 KB instead. Aliasing the root to the
// ESM build does not help, because that object literal is still what it exports.
import isEmail from "validator/es/lib/isEmail";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { green } from "@mui/material/colors";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeLogonIfFormValid, updateInput } from "../../actions/login";
import { ErrorMessage } from "../../errors";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { withSearchAndHash } from "../../utils";

/*
 * login_hint decides only whether the username field is prefilled. The server
 * remains the authority on what is a valid identity.
 *
 * A hint may be a whole address or just the local part of one, so the local part
 * is recognised by testing it against a placeholder domain.
 */
function looksLikeIdentity(hint: string): boolean {
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
function withAsciiDomain(username: string): string {
  const at = username.lastIndexOf("@");
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

/*
 * The progress ring sits centred on top of the button that started the request.
 * The offsets are half its 24px size, so they are pixel values divided by the
 * 8px spacing unit rather than spacing steps of their own.
 */
const buttonProgressSx = {
  color: green[500],
  position: "absolute",
  top: "50%",
  left: "50%",
  mt: -1.5,
  ml: -1.5,
} as const;

const wrapperSx = {
  position: "relative",
  display: "inline-block",
} as const;

export interface LoginProps {
  // Supplied by the Route which renders this screen.
  history: History;
}

function Login(props: LoginProps) {
  const { history } = props;

  const dispatch = useAppDispatch();

  const hello = useAppSelector((state) => state.common.hello);
  const branding = useAppSelector((state) => state.common.branding);
  const query = useAppSelector((state) => state.common.query);
  const loading = useAppSelector((state) => state.login.loading);
  const errors = useAppSelector((state) => state.login.errors);
  const username = useAppSelector((state) => state.login.username);
  const password = useAppSelector((state) => state.login.password);

  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // This effect decides once, on mount, whether an already signed-in visitor
  // should be redirected onwards and whether login_hint should prefill the
  // username. Naming its dependencies would re-run both on every change to the
  // query, the history or the store, which would fight the user as they type.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if (hello?.state && history.action !== "PUSH") {
      if (!query.prompt || query.prompt.indexOf("select_account") === -1) {
        dispatch(advanceLogonFlow(true, history));
        return;
      }

      history.replace(withSearchAndHash("/chooseaccount", history.location));
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

  const handleChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    dispatch(updateInput(name, event.target.value));
  };

  const handleNextClick = (event: React.SyntheticEvent) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(withAsciiDomain(username), password, false)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  };

  const usernamePlaceHolder = useMemo(() => {
    if (branding?.usernameHintText) {
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
          helperText={<ErrorMessage error={errors.username} values={{ what: usernamePlaceHolder }}></ErrorMessage>}
          fullWidth
          autoFocus
          slotProps={{
            htmlInput: {
              autoCapitalize: "off",
              spellCheck: "false",
            },
          }}
          value={username}
          onChange={handleChange("username")}
          autoComplete="kopano-account username"
          variant="outlined"
          sx={{ mt: 1, mb: 1.5 }}
        />
        <TextField
          inputRef={passwordInputRef}
          type={showPassword ? "text" : "password"}
          label={t("konnect.login.passwordField.label", "Password")}
          error={!!errors.password}
          helperText={<ErrorMessage error={errors.password}></ErrorMessage>}
          fullWidth
          onChange={handleChange("password")}
          autoComplete="kopano-account current-password"
          variant="outlined"
          slotProps={{
            input: {
              // End-adornment icon to show/hide password on visibility button click.
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((show) => !show)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    edge="end"
                    size="large"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <DialogActions>
          <Box sx={wrapperSx}>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              sx={{ m: 1, minWidth: 100 }}
              disabled={!!loading}
              onClick={handleNextClick}
            >
              {t("konnect.login.nextButton.label", "Next")}
            </Button>
            {loading && <CircularProgress size={24} sx={buttonProgressSx} />}
          </Box>
        </DialogActions>

        {errors.http && (
          <Typography variant="subtitle2" color="error" sx={{ mt: 2, mb: 2 }}>
            <ErrorMessage error={errors.http}></ErrorMessage>
          </Typography>
        )}

        {branding?.signinPageText && <Typography variant="body2">{branding.signinPageText}</Typography>}
      </form>
    </DialogContent>
  );
}

export default Login;
