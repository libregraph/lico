import type { NavigateProps } from "react-router";
import { Navigate, useLocation } from "react-router";

// Callers supply the target and whatever else they want handed to Navigate.
export interface RedirectWithQueryProps extends Omit<NavigateProps, "to"> {
  target: string;
}

/*
 * The query string and the fragment are the OIDC request, so a redirect which
 * dropped them would send the user to a screen that no longer knows what was
 * being asked for.
 *
 * replace is set here because every caller is a guard: the path being left is
 * one the user was not allowed to see, and leaving it in the back history means
 * the browser's back button walks into the guard again. Navigate pushes by
 * default, unlike the Redirect it replaces, so this is not a detail the callers
 * can be left to remember.
 */
const RedirectWithQuery = ({ target, ...rest }: RedirectWithQueryProps) => {
  const location = useLocation();

  const to = {
    pathname: target,
    search: location.search,
    hash: location.hash,
  };

  return <Navigate to={to} replace {...rest} />;
};

export default RedirectWithQuery;
