import React from 'react';
import { Route, RouteComponentProps } from "react-router-dom";

import RedirectWithQuery from "./RedirectWithQuery";
import { ReactElement } from "react";

const PrivateRoute: React.FC<{ component: React.FC, hello: object, [key: string]: boolean | string | object | ReactElement }> = ({ component: Target, hello, ...rest }) => (
  <Route
    {...rest}
    render={(props: RouteComponentProps<{ [x: string]: string | undefined; }>) =>
      hello ? <Target {...props as object} /> : <RedirectWithQuery target="/identifier" />
    }
  />
);

export default PrivateRoute;
