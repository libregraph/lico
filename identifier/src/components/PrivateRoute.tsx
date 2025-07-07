import React from 'react';

import RedirectWithQuery from './RedirectWithQuery';
import { HelloDetails } from '../types/common';

interface PrivateRouteProps {
  children: React.ReactNode;
  hello: HelloDetails | null | undefined;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, hello }) => {
  return hello ? (
    <>{children}</>
  ) : (
    <RedirectWithQuery target='/identifier' />
  );
};

export default PrivateRoute;
