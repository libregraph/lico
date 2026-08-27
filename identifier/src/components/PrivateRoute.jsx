
import PropTypes from 'prop-types';
import { Route } from 'react-router-dom';

import RedirectWithQuery from './RedirectWithQuery';

// The hello state is an object as soon as the server has answered, whether or
// not anyone is signed in, so its presence alone says nothing. Only its state
// flag does.
const PrivateRoute = ({ component: Target, hello, ...rest }) => (
  <Route {...rest} render={props => (
    hello?.state ? (
      <Target {...props}/>
    ) : (
      <RedirectWithQuery target='/identifier' />
    )
  )}/>
);

PrivateRoute.propTypes = {
  component: PropTypes.elementType.isRequired,
  hello: PropTypes.object
};

export default PrivateRoute;
