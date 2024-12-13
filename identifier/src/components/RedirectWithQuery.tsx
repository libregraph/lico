import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Redirect } from 'react-router-dom';

interface RedirectWithQueryProps extends RouteComponentProps {
  target: string, location: { [key: string]: string | undefined }
}

const RedirectWithQuery: React.FC<RedirectWithQueryProps> = ({ target, location, ...rest }) => {
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
