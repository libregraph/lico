import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";

import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeConsent } from "../../actions/login";
import BusyButton from "../../components/BusyButton";
import ClientDisplayName from "../../components/ClientDisplayName";
import RequestError from "../../components/RequestError";
import ScopesList from "../../components/ScopesList";
import { useFlowNavigation, useRedirectUnlessPushed } from "../../hooks/navigation";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectHello } from "../../reducers/common";
import { receiveValidateLogon, requestConsentAllow, selectErrors, selectLoading } from "../../reducers/login";

function Consent() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const nav = useFlowNavigation();
  const hello = useAppSelector(selectHello);
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  // No session means no client, and the mount guard tests for exactly that, so
  // it must not be given an empty object which would read as one being present.
  const client = hello?.details ? hello.details.client : undefined;

  // Nothing to consent to without a session and a client asking for one.
  useRedirectUnlessPushed(!hello?.state || !client);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design
  useEffect(() => {
    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
  }, []);

  // No default for allow: the form passes it undefined to mean "decide nothing",
  // and a default would turn that into an explicit refusal.
  const action =
    (allow: boolean | undefined, scopes: Record<string, boolean> = {}) =>
    (event: React.SyntheticEvent) => {
      event.preventDefault();

      if (allow === undefined) {
        return;
      }

      // Convert all scopes which are true to a scope value.
      const scope = Object.keys(scopes)
        .filter((scope) => {
          return !!scopes[scope];
        })
        .join(" ");

      dispatch(executeConsent(allow, scope)).then((response) => {
        if (response.success) {
          dispatch(advanceLogonFlow(response.success, nav, true, { konnect: response.state }));
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

  /*
   * The domain behind the icon, and only when it is one a visitor could
   * recognise. The registry decides which is which and this mirrors it: a web
   * client's redirect URI is https and never loopback, while a native client's
   * is a custom scheme or http on localhost
   * (identity/clients/registry.go:138-177). A client returning to
   * `msauth://com.microsoft...` or `localhost:53682` has no destination worth
   * naming, so it gets no icon either.
   */
  let redirectHost = "";
  if (client.redirect_uri) {
    try {
      const uri = new URL(client.redirect_uri);
      const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(uri.hostname);
      if ((uri.protocol === "https:" || uri.protocol === "http:") && !loopback) {
        redirectHost = uri.host;
      }
    } catch {
      // Not a URI this browser can read, so there is no host to promise.
    }
  }

  return (
    <DialogContent>
      <Typography variant="h5" component="h3">
        {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello.displayName })}
      </Typography>
      {/* Context for the decision, not the subject of it. */}
      <Typography variant="subtitle1" sx={{ mb: 2, color: "text.secondary" }}>
        {hello.username}
      </Typography>

      {/*
       * The subject of the screen, so it outranks the greeting above it rather
       * than sitting a step below at body size. The gap below it is a step of
       * the spacing scale rather than gutterBottom's 0.35em, which landed on 7px
       * here and read as an accident beside the 16px between every other block.
       */}
      <Typography variant="h6" component="p" sx={{ mb: 1 }}>
        {/*
         * The translations address this child by position: konnect.consent.message
         * is "<0></0> wants to:". Reflowing the JSX inserts a {" "} child before
         * it, which shifts the index and silently wraps the wrong node, so this
         * stays on the lines it was written on. The span carries no styling of
         * its own now that the whole line is set in the heading weight; it
         * exists because the sentence structure is the translators' contract.
         */}
        {/* biome-ignore format: children are index-mapped by the translations */}
        <Trans t={t} i18nKey="konnect.consent.message">
          <Box component="span"><ClientDisplayName client={client}/></Box> wants to:
        </Trans>
      </Typography>
      <ScopesList dense disablePadding sx={{ mb: 0 }} scopes={scopes} meta={meta}></ScopesList>

      {/*
       * What the buttons cannot say. The two sentences that used to sit here
       * asked the question Allow answers and then restated it in lower
       * contrast, so both are gone. This one reports that the list above is
       * still only a proposal, which is the thing a visitor cannot see and the
       * reason Cancel is safe.
       *
       * The whole redirect URI used to be here, then just its host. Neither
       * belongs on the page: none of the sign-in pages this was measured
       * against shows a redirect target, and for a native client it is a custom
       * scheme or a loopback port, which reads like a fault. The domain is
       * detail, so it sits behind the icon.
       */}
      {/*
       * text.secondary rather than the secondary palette colour, which lands on
       * blueGrey[400] and measures 3.35:1 on the card — under the 4.5:1 this
       * sentence needs. The icon inside inherits it.
       */}
      <Typography variant="subtitle1" sx={{ mt: 2, color: "text.secondary" }}>
        {t("konnect.consent.nothingShared", "Nothing is shared until you click Allow.")}
        {redirectHost ? (
          /* Above, because this line sits directly over Allow and Cancel. */
          <Tooltip
            describeChild
            placement="top"
            title={t("konnect.consent.redirect", 'Clicking "Allow" will redirect you to {{host}}', {
              host: redirectHost,
            })}
          >
            <InfoOutlined sx={{ fontSize: 14, ml: 0.5, verticalAlign: "text-bottom" }} />
          </Tooltip>
        ) : null}
      </Typography>

      <form action="" onSubmit={action(undefined, scopes)}>
        {/*
         * The margin belongs to the row, not to each button. Its own top
         * padding goes, because that padding sat on top of the margin and put
         * 24px above the buttons where every other gap on the card is 16.
         */}
        <DialogActions sx={{ mt: 2, pt: 0 }}>
          <BusyButton
            color="secondary"
            variant="outlined"
            /* Its own label needs 4.5:1, which the secondary palette colour
               does not reach; the outline it keeps only needs 3:1. */
            sx={{ color: "text.secondary" }}
            disabled={!!loading}
            busy={!!loading && loading !== requestConsentAllow.type}
            onClick={action(false, scopes)}
          >
            {t("konnect.consent.cancelButton.label", "Cancel")}
          </BusyButton>
          <BusyButton
            type="submit"
            color="primary"
            variant="contained"
            disabled={!!loading}
            busy={loading === requestConsentAllow.type}
            onClick={action(true, scopes)}
          >
            {t("konnect.consent.allowButton.label", "Allow")}
          </BusyButton>
        </DialogActions>

        <RequestError error={errors.http} />
      </form>
    </DialogContent>
  );
}

export default Consent;
