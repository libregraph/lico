import React, { lazy } from 'react';

import { Route, Switch } from 'react-router-dom';

import PrivateRoute from './components/PrivateRoute';
import { ObjectType } from './types';

type RootType = {
  hello: ObjectType;
}


type ComponentType = Promise<{ default: React.ComponentType<object> }>

const AsyncLogin = lazy(() =>
  import(/* webpackChunkName: "containers-login" */ './containers/Login') as ComponentType);
const AsyncWelcome = lazy(() =>
  import(/* webpackChunkName: "containers-welcome" */ './containers/Welcome') as ComponentType);
const AsyncGoodbye = lazy(() =>
  import(/* webpackChunkName: "containers-goodbye" */ './containers/Goodbye') as ComponentType);

const Routes = ({ hello }: RootType) => (
  <Switch>
    <PrivateRoute
      path="/welcome"
      exact
      component={AsyncWelcome}
      hello={hello}
    />
    <Route
      path="/goodbye"
      exact
      component={AsyncGoodbye}
    />
    <Route
      path="/"
      component={AsyncLogin}
    />
  </Switch>
);

export default Routes;
