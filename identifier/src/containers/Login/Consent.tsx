import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";

import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import type { TooltipProps as BaseTooltipProps } from "@mui/material/Tooltip";
import BaseTooltip from "@mui/material/Tooltip";
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

/*
 * The base tooltip takes a single element, which is exactly what this wrapper
 * guarantees. Its own children are widened to any node so the Trans component
 * can hand it whatever the translation interpolates.
 */
interface TooltipProps extends Omit<BaseTooltipProps, "children"> {
  children: React.ReactNode;
}

const Tooltip = ({ children, ...other }: TooltipProps) => {
  // Ensures that there is only a single child for the tooltip element to
  // make it compatible with the Trans component.
  return (
    <BaseTooltip {...other}>
      <span>{children}</span>
    </BaseTooltip>
  );
};

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

  return (
    <DialogContent>
      <Typography variant="h5" component="h3">
        {t("konnect.consent.headline", "Hi {{displayName}}", { displayName: hello.displayName })}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {hello.username}
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        {/*
         * The translations address these children by position: konnect.consent.message
         * is "<0><0><0></0></0></0> wants to". Reflowing the JSX inserts {" "}
         * children between the elements, which shifts every index after the first
         * and silently wraps the wrong node, so this stays on the lines it was
         * written on.
         */}
        {/* biome-ignore format: children are index-mapped by the translations */}
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
        {/* biome-ignore format: children are index-mapped by the translations, see above */}
        <Trans t={t} i18nKey="konnect.consent.question">
          Allow <em><ClientDisplayName client={client}/></em> to do this?
        </Trans>
      </Typography>
      <Typography color="secondary">
        {t("konnect.consent.consequence", "By clicking Allow, you allow this app to use your information.")}
      </Typography>

      <form action="" onSubmit={action(undefined, scopes)}>
        {/* The margin belongs to the row, not to each button. */}
        <DialogActions sx={{ mt: 2 }}>
          <BusyButton
            color="secondary"
            variant="outlined"
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
