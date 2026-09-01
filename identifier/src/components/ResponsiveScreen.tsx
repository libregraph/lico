
import type React from 'react';

import { createStyles, withStyles } from '@material-ui/core/styles';
import type { Theme } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import type { GridProps } from '@material-ui/core/Grid';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import type { DialogProps as MuiDialogProps } from '@material-ui/core/Dialog';

import ResponsiveDialog from './ResponsiveDialog';
import Logo from '../images/app-icon.svg';
import Loading from './Loading';
import LocaleSelect from './LocaleSelect';
import type { Branding } from '../models/api';

const styles = (theme: Theme) => createStyles({
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
  logoSmall: {
    height: 12,
  },
  logoNormal: {
    height: 24,
  },
  logoBig: {
    height: 48,
  },
  actions: {
    marginTop: -40,
    minHeight: 45,
    justifyContent: 'flex-start',
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3)
  }
});

export interface ResponsiveScreenProps extends Omit<GridProps, 'classes' | 'className' | 'children'> {
  classes: {
    root: string;
    content: string;
    dialog: string;
    logoSmall: string;
    logoNormal: string;
    logoBig: string;
    actions: string;
  };
  withoutLogo?: boolean;
  withoutPadding?: boolean;
  loading?: boolean;
  branding?: Branding | null;
  // Absent while loading, which is the one case where this screen has nothing
  // of its own to show.
  children?: React.ReactNode;
  className?: string;
  PaperProps?: MuiDialogProps['PaperProps'];
  DialogProps?: Partial<MuiDialogProps>;
}

const ResponsiveScreen = (props: ResponsiveScreenProps) => {
  const {
    classes,
    withoutLogo = false,
    withoutPadding = false,
    loading = false,
    branding,
    children,
    className,
    DialogProps,
    PaperProps,
    ...other
  } = props;

  const bannerLogoSrc = branding?.bannerLogo ? branding.bannerLogo : Logo;
  const logoSizeClassMap: Record<string, string> = { small: classes.logoSmall, normal: classes.logoNormal, big: classes.logoBig };
  const logoClassName = (branding?.bannerLogoHeight && logoSizeClassMap[branding.bannerLogoHeight]) || classes.logoNormal;
  const logo = withoutLogo ? null :
    <DialogContent><img src={bannerLogoSrc} className={logoClassName} alt=""/></DialogContent>;

  const content = loading ? <Loading/> : (withoutPadding ? children : <DialogContent>{children}</DialogContent>);

  return (
    <Grid container justifyContent="center" alignItems="center" spacing={0}
      className={[classes.root, className].filter(Boolean).join(' ')} {...other}>
      <ResponsiveDialog open fullWidth maxWidth="sm" disableEscapeKeyDown hideBackdrop
        {...DialogProps}
        PaperProps={{elevation: 4, ...PaperProps}}
        classes={{
          paperWidthSm: classes.dialog,
        }}
      >
        <div className={classes.content}>
          {branding?.signinPageLogoURI ? (
            <a
              href={branding.signinPageLogoURI}
              target="_blank"
              rel="noopener noreferrer"
            >
              {logo}
            </a>
          ) : (
            logo
          )}
          {content}
        </div>
        {!loading && <DialogActions className={classes.actions} disableSpacing><LocaleSelect disableUnderline locales={branding?.locales}/></DialogActions>}
      </ResponsiveDialog>
    </Grid>
  );
};

export default withStyles(styles)(ResponsiveScreen);
