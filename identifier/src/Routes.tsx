import React, { lazy } from 'react';
import { Routes as RouterRoutes, Route } from 'react-router-dom';

import PrivateRoute from './components/PrivateRoute';
import { HelloDetails } from './types/common';

const AsyncLogin = lazy(() =>
  import(/* webpackChunkName: "containers-login" */ './containers/Login'));
const AsyncWelcome = lazy(() =>
  import(/* webpackChunkName: "containers-welcome" */ './containers/Welcome'));
const AsyncGoodbye = lazy(() =>
  import(/* webpackChunkName: "containers-goodbye" */ './containers/Goodbye'));

interface RoutesProps {
  hello?: HelloDetails | null;
}

const Routes = ({ hello }: RoutesProps) => (
  <RouterRoutes>
    <Route
      path="/welcome"
      element={
        <PrivateRoute hello={hello}>
          <AsyncWelcome />
        </PrivateRoute>
      }
    />
    <Route
      path="/goodbye"
      element={<AsyncGoodbye />}
    />
    <Route
      path="/*"
      element={<AsyncLogin />}
    />
  </RouterRoutes>
);

export default Routes;
