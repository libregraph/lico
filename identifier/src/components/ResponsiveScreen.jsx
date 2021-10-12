import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { withStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import DialogContent from '@material-ui/core/DialogContent';

import ResponsiveDialog from './ResponsiveDialog';
import Logo from '../images/app-icon.svg';
import Loading from './Loading';

const styles = theme => ({
  root: {
    display: 'flex',
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 12,
    minHeight: 350,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    position: 'relative'
  },
  dialog: {
    maxWidth: 440,
  },
  logo: {
    height: 24,
  },
  actions: {
    marginTop: -40,
    justifyContent: 'flex-start',
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3)
  }
});

const ResponsiveScreen = (props) => {
  const {
    classes,
    withoutLogo,
    withoutPadding,
    loading,
    hello,
    children,
    className,
    DialogProps,
    PaperProps,
    ...other
  } = props;

  const bannerLogoSrc = hello?.details?.branding?.bannerLogo ? hello.details.branding.bannerLogo : Logo;
  const logo = withoutLogo ? null :
    <DialogContent><img src={bannerLogoSrc} className={classes.logo} alt=""/></DialogContent>;

  const content = loading ? <Loading/> : (withoutPadding ? children : <DialogContent>{children}</DialogContent>);

  return (
    <Grid container justifyContent="center" alignItems="center" spacing={0}
      className={classNames(classes.root, className)} {...other}>
      <ResponsiveDialog open fullWidth maxWidth="sm" disableEscapeKeyDown hideBackdrop
        {...DialogProps}
        PaperProps={{elevation: 4, ...PaperProps}}
        classes={{
          paperWidthSm: classes.dialog,
        }}
      >
        <div className={classes.content}>
          {logo}
          {content}
        </div>
      </ResponsiveDialog>
    </Grid>
  );
};

ResponsiveScreen.defaultProps = {
  withoutLogo: false,
  withoutPadding: false,
  loading: false
};

ResponsiveScreen.propTypes = {
  classes: PropTypes.object.isRequired,
  withoutLogo: PropTypes.bool,
  withoutPadding: PropTypes.bool,
  loading: PropTypes.bool,
  hello: PropTypes.object,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  PaperProps: PropTypes.object,
  DialogProps: PropTypes.object

};

export default withStyles(styles)(ResponsiveScreen);
