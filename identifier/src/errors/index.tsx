import { useTranslation } from "react-i18next";

export const ERROR_LOGIN_VALIDATE_MISSINGUSERNAME = "konnect.error.login.validate.missingUsername";
export const ERROR_LOGIN_VALIDATE_MISSINGPASSWORD = "konnect.error.login.validate.missingPassword";
export const ERROR_LOGIN_FAILED = "konnect.error.login.failed";
export const ERROR_HTTP_NETWORK_ERROR = "konnect.error.http.networkError";
export const ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS = "konnect.error.http.unexpectedResponseStatus";
export const ERROR_HTTP_UNEXPECTED_RESPONSE_STATE = "konnect.error.http.unexpectedResponseState";

// Error with values.
export class ExtendedError extends Error {
  values: Record<string, unknown> | undefined = undefined;

  constructor(message: string, values?: Record<string, unknown>) {
    super(message);
    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, ExtendedError);
    }
    this.values = values;
  }
}

/*
 * Narrows a caught value to an Error. Everything raised here and by the
 * transport is already one; anything else could only come from an unexpected
 * failure, and is wrapped rather than stored as-is so the slices that keep it
 * stay honest about what they hold.
 */
export function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/*
 * What ErrorMessage can be handed. The message is the translation key, and the
 * values are interpolated into it. A plain Error satisfies this, so an error
 * caught from anywhere can go straight in.
 */
export interface TranslatableError {
  message: string;
  values?: Record<string, unknown>;
}

interface ErrorMessageProps {
  error?: TranslatableError | null;
  values?: Record<string, unknown>;
}

// Component to translate error text with values.
export function ErrorMessage(props: ErrorMessageProps) {
  const { error, values } = props;

  const { t } = useTranslation();

  if (!error) {
    return null;
  }

  // Values named at the call site win over those the error carried with it.
  const interpolation = { ...error.values, ...values };

  switch (error.message) {
    case ERROR_LOGIN_VALIDATE_MISSINGUSERNAME:
      return <>{t("konnect.error.login.validate.missingUsername", "Enter a valid value.", interpolation)}</>;
    case ERROR_LOGIN_VALIDATE_MISSINGPASSWORD:
      return <>{t("konnect.error.login.validate.missingPassword", "Enter your password.")}</>;
    case ERROR_LOGIN_FAILED:
      return <>{t("konnect.error.login.failed", "Logon failed. Please verify your credentials and try again.")}</>;
    case ERROR_HTTP_NETWORK_ERROR:
      return <>{t("konnect.error.http.networkError", "Network error. Please check your connection and try again.")}</>;
    case ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS:
      return (
        <>
          {t(
            "konnect.error.http.unexpectedResponseStatus",
            "Unexpected HTTP response: {{status}}. Please check your connection and try again.",
            interpolation,
          )}
        </>
      );
    case ERROR_HTTP_UNEXPECTED_RESPONSE_STATE:
      return (
        <>{t("konnect.error.http.unexpectedResponseState", "Unexpected response state: {{state}}", interpolation)}</>
      );
    default:
  }

  /*
   * Every error this application raises carries one of the keys above. Anything
   * else has no key to look up, and renders nothing: the lookup this replaces
   * asked for an absent key, which i18next answered with an empty string.
   */
  return null;
}
