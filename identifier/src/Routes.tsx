import { lazy } from "react";
import { Route, Switch } from "react-router-dom";

import PrivateRoute from "./components/PrivateRoute";
import type { Session } from "./models/api";

const AsyncLogin = lazy(() => import("./containers/Login"));
const AsyncWelcome = lazy(() => import("./containers/Welcome"));
const AsyncGoodbye = lazy(() => import("./containers/Goodbye"));

export interface RoutesProps {
  // Null until the first hello answers, which is why the welcome route is
  // guarded rather than rendered directly.
  hello: Session | null;
}

const Routes = ({ hello }: RoutesProps) => (
  <Switch>
    <PrivateRoute path="/welcome" exact component={AsyncWelcome} hello={hello} />
    <Route path="/goodbye" exact component={AsyncGoodbye} />
    <Route path="/" component={AsyncLogin} />
  </Switch>
);

export default Routes;
