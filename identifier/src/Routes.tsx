import { lazy } from "react";
import { Route, Routes } from "react-router";

import PrivateRoute from "./components/PrivateRoute";
import type { Session } from "./models/api";

const AsyncLogin = lazy(() => import("./containers/Login"));
const AsyncWelcome = lazy(() => import("./containers/Welcome"));
const AsyncGoodbye = lazy(() => import("./containers/Goodbye"));

export interface AppRoutesProps {
  // Null until the first hello answers, which is why the welcome route is
  // guarded rather than rendered directly.
  hello: Session | null;
}

/*
 * The login route matches with a trailing splat, because everything it does not
 * name itself - /identifier, /chooseaccount, /consent and anything unknown -
 * belongs to the screen it renders, which dispatches on the rest of the path.
 */
const AppRoutes = ({ hello }: AppRoutesProps) => (
  <Routes>
    <Route
      path="/welcome"
      element={
        <PrivateRoute hello={hello}>
          <AsyncWelcome />
        </PrivateRoute>
      }
    />
    <Route path="/goodbye" element={<AsyncGoodbye />} />
    <Route path="/*" element={<AsyncLogin />} />
  </Routes>
);

export default AppRoutes;
