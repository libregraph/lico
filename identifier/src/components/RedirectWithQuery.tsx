import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';

const RedirectWithQuery = ({target}: {target: string}) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const to = `${target}${location.search}${location.hash}`;
    navigate(to, { replace: true });
  }, [target, location.search, location.hash, navigate]);

  return null;
};

RedirectWithQuery.propTypes = {
  target: PropTypes.string.isRequired
};

export default RedirectWithQuery;
