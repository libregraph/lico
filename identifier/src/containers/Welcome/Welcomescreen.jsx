import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import { executeLogoff } from '../../actions/common';

const styles = theme => ({
  button: {
    margin: theme.spacing(1),
    minWidth: 100
  },
  subHeader: {
    marginBottom: theme.spacing(5)
  }
});

function Welcomescreen(props) {
  const { classes, history } = props;

  const { t } = useTranslation();

  const dispatch = useDispatch();
  const branding = useSelector(state => state.common.branding);
  const hello = useSelector(state => state.common.hello);

  const handleLogoff = (event) => {
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
      <Typography variant="subtitle1" className={classes.subHeader}>
        {hello.username}
      </Typography>

      <Typography gutterBottom>
        {t("konnect.welcome.message", "You are signed in - awesome!")}
      </Typography>

      <DialogActions>
        <Button
          color="secondary"
          className={classes.button}
          variant="contained"
          onClick={handleLogoff}
        >
          {t("konnect.welcome.signoutButton.label", "Sign out")}
        </Button>
      </DialogActions>
    </ResponsiveScreen>
  );
}

Welcomescreen.propTypes = {
  classes: PropTypes.object.isRequired,

  history: PropTypes.object.isRequired
};

export default withStyles(styles)(Welcomescreen);
