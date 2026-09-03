import { useEffect } from "react";
import type { Location, NavigateFunction, NavigationType } from "react-router";
import { useLocation, useNavigate, useNavigationType } from "react-router";

import { withSearchAndHash } from "../utils";

/*
 * What the logon flow needs in order to move: where it is, how it got there,
 * and how to leave.
 *
 * The thunks which advance the flow used to be handed the router's history
 * object. Version 8 has none to hand them, and a thunk cannot call hooks, so
 * the component which dispatches reads these three and passes them on.
 *
 * navigationType is not decoration. Several screens decide on mount whether
 * they were reached by an in-app navigation or by a fresh page load, and only
 * the second is allowed to bounce the visitor onwards. Dropping it would make
 * the browser's back button walk back into a redirect.
 */
export interface FlowNavigation {
  navigate: NavigateFunction;
  location: Location;
  // Widened to the enum's own strings, which is what the guards compare against.
  navigationType: `${NavigationType}`;
}

export const useFlowNavigation = (): FlowNavigation => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  return { navigate, location, navigationType };
};

/*
 * Sends the visitor away unless the application itself navigated them here.
 *
 * The screens this guards sit in the middle of a flow, so a fresh page load or
 * a back button means the state they need was never established and they have
 * nothing to show; a PUSH means the flow put the visitor here deliberately, and
 * then they stay whatever the session says. Dropping the second half of that
 * would make the browser's back button walk into a redirect.
 *
 * The decision is taken once, on mount, from the values as they were then.
 * Naming them as dependencies would re-run it whenever the session or the
 * location changed, which is exactly what it must not do: the screens change
 * both themselves.
 */
export function useRedirectUnlessPushed(when: boolean, target = "/identifier"): void {
  const { navigate, location, navigationType } = useFlowNavigation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design, see above
  useEffect(() => {
    if (when && navigationType !== "PUSH") {
      navigate(withSearchAndHash(target, location), { replace: true });
    }
  }, []);
}
