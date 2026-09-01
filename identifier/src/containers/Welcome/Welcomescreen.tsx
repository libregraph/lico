import type { History } from 'history';

import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogActions from '@mui/material/DialogActions';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeLogoff } from '../../actions/common';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';

export interface WelcomescreenProps {
  // Supplied by the Route which renders this screen.
  history: History;
}

function Welcomescreen(props: WelcomescreenProps) {
  const { history } = props;

  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const branding = useAppSelector(state => state.common.branding);
  const hello = useAppSelector(state => state.common.hello);

  const handleLogoff = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    dispatch(executeLogoff()).then((response) => {
      if (response.success) {
        history.push('/identifier');
      }
    });
  };

  // The children are built before ResponsiveScreen decides whether to show the
  // loading state, so return early rather than dereference a session which
  // signing out has already cleared.
  if (hello === null) {
    return <ResponsiveScreen loading branding={branding}/>;
  }

  return (
    <ResponsiveScreen branding={branding}>
      <Typography variant="h5" component="h3">
        {t("konnect.welcome.headline", "Welcome {{displayName}}", {displayName: hello.displayName})}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 5 }}>
        {hello.username}
      </Typography>

      <Typography gutterBottom>
        {t("konnect.welcome.message", "You are signed in - awesome!")}
      </Typography>

      <DialogActions>
        <Button
          color="secondary"
          sx={{ m: 1, minWidth: 100 }}
          variant="contained"
          onClick={handleLogoff}
        >
          {t("konnect.welcome.signoutButton.label", "Sign out")}
        </Button>
      </DialogActions>
    </ResponsiveScreen>
  );
}

export default Welcomescreen;
