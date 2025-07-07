import React from 'react';

import RedirectWithQuery from './RedirectWithQuery';

interface PrivateRouteProps {
  children: React.ReactNode;
  hello: Record<string, unknown> | null;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, hello }) => {
  return hello ? (
    <>{children}</>
  ) : (
    <RedirectWithQuery target='/identifier' />
  );
};

export default PrivateRoute;
