import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface RedirectWithQueryProps {
  target: string;
}

const RedirectWithQuery: React.FC<RedirectWithQueryProps> = ({ target }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const to = `${target}${location.search}${location.hash}`;
    navigate(to, { replace: true });
  }, [target, location.search, location.hash, navigate]);

  return null;
};

export default RedirectWithQuery;
