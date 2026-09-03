import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// The ESM build, imported by module path. The package root is a CommonJS barrel
// whose default export is one object literal holding every validator, so nothing
// can be shaken out of it and the whole library ships: 122 KB to answer one
// question. This path is the same source compiled to ESM and reaches six
// modules, which is why it costs about 5 KB instead. Aliasing the root to the
// ESM build does not help, because that object literal is still what it exports.
import isEmail from "validator/es/lib/isEmail";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeLogonIfFormValid } from "../../actions/login";
import BusyButton from "../../components/BusyButton";
import Loading from "../../components/Loading";
import RedirectWithQuery from "../../components/RedirectWithQuery";
import RequestError from "../../components/RequestError";
import { ErrorMessage } from "../../errors";
import { useFlowNavigation } from "../../hooks/navigation";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectBranding, selectHello } from "../../reducers/common";
import { clearFieldError, selectErrors, selectLoading } from "../../reducers/login";
import { useSignInRequest } from "../../request";

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

function Login() {
  const dispatch = useAppDispatch();
  const nav = useFlowNavigation();
  const { query } = useSignInRequest();

  const hello = useAppSelector(selectHello);
  const branding = useAppSelector(selectBranding);
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  const { t } = useTranslation();

  /*
   * Both fields stay here rather than in the store, so they are gone with this
   * screen and are never recorded by the devtools. The thunks which post them
   * take their values as arguments.
   */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  /*
   * Whether this visitor is only passing through, decided on mount. The
   * initialiser is what freezes it: this screen's own form fills the store and
   * moves the location, and re-deciding later would take a visitor off a screen
   * they are legitimately using.
   */
  const [passingThrough] = useState(() => !!hello?.state && nav.navigationType !== "PUSH");
  const [selectAccount] = useState(() => !!query.prompt && query.prompt.indexOf("select_account") !== -1);

  // The other half of the mount decision, which is a prefill rather than a
  // departure. Naming its dependencies would re-run it on every change to the
  // query, the location or the store, which would fight the user as they type.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if (passingThrough) {
      // Asking to select an account is answered by the redirect rendered below,
      // so only the flow advancing has anything to dispatch here.
      if (!selectAccount) {
        dispatch(advanceLogonFlow(true, nav));
      }

      return;
    }

    // Prefill the username from login_hint when it looks like an identity.
    if (query?.login_hint && looksLikeIdentity(query.login_hint)) {
      setUsername(query.login_hint);

      // Move focus on to the password once the field above has its value. The
      // timer is cleared on unmount, because otherwise the callback runs against
      // a component which has already gone and the ref is null by then.
      const focusPassword = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 0);

      return () => clearTimeout(focusPassword);
    }
  }, []);

  /*
   * The store still holds what the validator or the server said about a field,
   * so editing one withdraws that complaint. The value itself never leaves
   * this component.
   */
  const handleChange =
    (name: "username" | "password", set: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      set(event.target.value);
      if (errors[name]) {
        dispatch(clearFieldError(name));
      }
    };

  const handleNextClick = (event: React.SyntheticEvent) => {
    event.preventDefault();

    dispatch(executeLogonIfFormValid(withAsciiDomain(username), password, false)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, nav));
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

  /*
   * A visitor who is only passing through is never shown a credential form.
   * Asking to select an account is a route change and is rendered as one, so
   * nothing is painted before the router follows it.
   *
   * The flow advancing is not a route change in every case: it may hand off to
   * the client with a full page navigation, and until that document arrives
   * this one stays on screen. The delay is what tells those two apart without
   * having to ask which it will be. A route change resolves inside it and shows
   * nothing; a hand-off outlives it and the visitor gets an indicator instead of
   * a card with a logo and no content. 800ms is the delay ProgressStrip uses.
   */
  if (passingThrough) {
    return selectAccount ? <RedirectWithQuery target="/chooseaccount" /> : <Loading delay={800} />;
  }

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
          onChange={handleChange("username", setUsername)}
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
          onChange={handleChange("password", setPassword)}
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
          <BusyButton
            type="submit"
            color="primary"
            variant="contained"
            disabled={!!loading}
            busy={!!loading}
            onClick={handleNextClick}
          >
            {t("konnect.login.nextButton.label", "Next")}
          </BusyButton>
        </DialogActions>

        <RequestError error={errors.http} />

        {branding?.signinPageText && <Typography variant="body2">{branding.signinPageText}</Typography>}
      </form>
    </DialogContent>
  );
}

export default Login;
