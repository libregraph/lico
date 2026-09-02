import type { Location, NavigateFunction, NavigationType } from "react-router";
import { useLocation, useNavigate, useNavigationType } from "react-router";

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
