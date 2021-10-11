import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import renderIf from 'render-if';
import { FormattedMessage } from 'react-intl';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import green from '@material-ui/core/colors/green';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';

import { updateInput, executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage } from '../../errors';

const styles = theme => ({
  button: {
    margin: theme.spacing(1),
    minWidth: 100
  },
  buttonProgress: {
    color: green[500],
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12
  },
  subHeader: {
    marginBottom: theme.spacing(3)
  },
  wrapper: {
    position: 'relative',
    display: 'inline-block'
  },
  message: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  }
});

class Login extends React.PureComponent {
  state = {};

  componentDidMount() {
    const { hello, query, dispatch, history } = this.props;
    if (hello && hello.state && history.action !== 'PUSH') {
      if (!query.prompt || query.prompt.indexOf('select_account') == -1) {
        dispatch(advanceLogonFlow(true, history));
        return;
      }

      history.replace(`/chooseaccount${history.location.search}${history.location.hash}`);
      return;
    }
  }

  render() {
    const { loading, errors, classes, username } = this.props;

    return (
      <div>
        <Typography variant="h5" component="h3">
          <FormattedMessage id="konnect.login.headline" defaultMessage="Sign in"></FormattedMessage>
        </Typography>
        <Typography variant="subtitle1" className={classes.subHeader}>
          <FormattedMessage id="konnect.login.subHeader" defaultMessage="with your Kopano account"></FormattedMessage>
        </Typography>

        <form action="" onSubmit={(event) => this.logon(event)}>
          <div>
            <TextField
              label={
                <FormattedMessage id="konnect.login.usernameField.label" defaultMessage="Username"></FormattedMessage>
              }
              error={!!errors.username}
              helperText={<ErrorMessage error={errors.username}></ErrorMessage>}
              fullWidth
              margin="normal"
              variant="outlined"
              autoFocus
              inputProps={{
                autoCapitalize: 'off',
                spellCheck: 'false'
              }}
              value={username}
              onChange={this.handleChange('username')}
              autoComplete="kopano-account username"
            />
            <TextField
              type="password"
              label={
                <FormattedMessage id="konnect.login.passwordField.label" defaultMessage="Password"></FormattedMessage>
              }
              error={!!errors.password}
              helperText={<ErrorMessage error={errors.password}></ErrorMessage>}
              fullWidth
              margin="normal"
              variant="outlined"
              onChange={this.handleChange('password')}
              autoComplete="kopano-account current-password"
            />
            <DialogActions>
              <div className={classes.wrapper}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.button}
                  disabled={!!loading}
                  onClick={(event) => this.logon(event)}
                >
                  <FormattedMessage id="konnect.login.nextButton.label" defaultMessage="Next"></FormattedMessage>
                </Button>
                {loading && <CircularProgress size={24} className={classes.buttonProgress} />}
              </div>
            </DialogActions>
          </div>

          {renderIf(errors.http)(() => (
            <Typography variant="subtitle2" color="error" className={classes.message}>
              <ErrorMessage error={errors.http}></ErrorMessage>
            </Typography>
          ))}
        </form>
      </div>
    );
  }

  handleChange(name) {
    return event => {
      this.props.dispatch(updateInput(name, event.target.value));
    };
  }

  logon(event) {
    event.preventDefault();

    const { username, password, dispatch, history } = this.props;
    dispatch(executeLogonIfFormValid(username, password, false)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, history));
      }
    });
  }
}

Login.propTypes = {
  classes: PropTypes.object.isRequired,

  loading: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  password: PropTypes.string.isRequired,
  errors: PropTypes.object.isRequired,
  hello: PropTypes.object,
  query: PropTypes.object.isRequired,

  dispatch: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired
};

const mapStateToProps = (state) => {
  const { loading, username, password, errors} = state.login;
  const { hello, query } = state.common;

  return {
    loading,
    username,
    password,
    errors,
    hello,
    query
  };
};

export default connect(mapStateToProps)(withStyles(styles)(Login));
