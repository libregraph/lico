import type React from "react";

import type { Session } from "../models/api";
import RedirectWithQuery from "./RedirectWithQuery";

export interface PrivateRouteProps {
  hello?: Session | null;
  children: React.ReactNode;
}

// The hello state is an object as soon as the server has answered, whether or
// not anyone is signed in, so its presence alone says nothing. Only its state
// flag does.
const PrivateRoute = ({ hello, children }: PrivateRouteProps) =>
  hello?.state ? children : <RedirectWithQuery target="/identifier" />;

export default PrivateRoute;
