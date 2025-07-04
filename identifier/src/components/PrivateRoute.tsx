import React from 'react';
import PropTypes from 'prop-types';

import RedirectWithQuery from './RedirectWithQuery';

const PrivateRoute = ({ children, hello }: { children: React.ReactNode, hello: any }) => {
  return hello ? (
    <>{children}</>
  ) : (
    <RedirectWithQuery target='/identifier' />
  );
};

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
  hello: PropTypes.object
};

export default PrivateRoute;
