import { NavigateFunction, Location } from 'react-router-dom';

export interface HistoryLike {
  push: (path: string) => void;
  replace: (path: string) => void;
  location: {
    search: string;
    hash: string;
  };
  action: string;
}

export function createHistoryWrapper(navigate: NavigateFunction, location: Location): HistoryLike {
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    location: {
      search: location.search,
      hash: location.hash,
    },
    action: 'PUSH', // Default for React Router v6
  };
}