import type React from "react";
import type { RouteComponentProps, RouteProps } from "react-router-dom";
import { Route } from "react-router-dom";

import type { Session } from "../models/api";
import RedirectWithQuery from "./RedirectWithQuery";

export interface PrivateRouteProps extends Omit<RouteProps, "component" | "render" | "children"> {
  component: React.ComponentType<RouteComponentProps>;
  hello?: Session | null;
}

// The hello state is an object as soon as the server has answered, whether or
// not anyone is signed in, so its presence alone says nothing. Only its state
// flag does.
const PrivateRoute = ({ component: Target, hello, ...rest }: PrivateRouteProps) => (
  <Route
    {...rest}
    render={(props) => (hello?.state ? <Target {...props} /> : <RedirectWithQuery target="/identifier" />)}
  />
);

export default PrivateRoute;
