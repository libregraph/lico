
import { withRouter } from 'react-router';
import type { RouteComponentProps } from 'react-router';
import { Redirect } from 'react-router-dom';
import type { RedirectProps } from 'react-router-dom';

// The router props arrive from withRouter, so callers only supply target and
// whatever else they want handed to Redirect.
export interface RedirectWithQueryProps extends RouteComponentProps, Omit<RedirectProps, 'to'> {
  target: string;
}

const RedirectWithQuery = ({target, location, ...rest}: RedirectWithQueryProps) => {
  const to = {
    pathname: target,
    search: location.search,
    hash: location.hash
  };

  return (
    <Redirect to={to} {...rest}></Redirect>
  );
};

export default withRouter(RedirectWithQuery);
