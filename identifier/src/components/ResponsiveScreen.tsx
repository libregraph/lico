import type React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import type { GridProps } from '@mui/material/Grid';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import type { DialogProps as MuiDialogProps } from '@mui/material/Dialog';

import ResponsiveDialog from './ResponsiveDialog';
import Logo from '../images/app-icon.svg';
import Loading from './Loading';
import LocaleSelect from './LocaleSelect';
import type { Branding } from '../models/api';

/*
 * The three logo heights the branding may ask for, in pixels. These are not
 * spacing units, so they are handed to sx unscaled.
 */
const logoHeights: Record<string, number> = {
  small: 12,
  normal: 24,
  big: 48
};

export interface ResponsiveScreenProps extends Omit<GridProps, 'classes' | 'className' | 'children'> {
  withoutLogo?: boolean;
  withoutPadding?: boolean;
  loading?: boolean;
  branding?: Branding | null;
  // Absent while loading, which is the one case where this screen has nothing
  // of its own to show.
  children?: React.ReactNode;
  className?: string;
  DialogProps?: Partial<MuiDialogProps>;
}

const ResponsiveScreen = (props: ResponsiveScreenProps) => {
  const {
    withoutLogo = false,
    withoutPadding = false,
    loading = false,
    branding,
    children,
    className,
    DialogProps,
    ...other
  } = props;

  const bannerLogoSrc = branding?.bannerLogo ? branding.bannerLogo : Logo;
  const logoHeight = (branding?.bannerLogoHeight && logoHeights[branding.bannerLogoHeight])
    || logoHeights.normal;
  const logo = withoutLogo ? null :
    <DialogContent>
      <Box component="img" src={bannerLogoSrc} sx={{ height: logoHeight }} alt=""/>
    </DialogContent>;

  const content = loading ? <Loading/> : (withoutPadding ? children : <DialogContent>{children}</DialogContent>);

  return (
    <Grid container spacing={0}
      sx={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center' }}
      className={className} {...other}>
      {/*
        * v4's disableEscapeKeyDown is gone and needs no replacement: this dialog
        * is given no onClose, and a Modal never closes itself, so escape had
        * nothing to call even before the prop was removed.
        */}
      <ResponsiveDialog open fullWidth maxWidth="sm" hideBackdrop
        {...DialogProps}
        slotProps={{
          // v4 reached the same width by overriding the paperWidthSm class.
          paper: { elevation: 4, sx: { maxWidth: 440 } }
        }}
      >
        <Box sx={{ pt: 3, pb: 1.5, minHeight: 350, px: 2, position: 'relative' }}>
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
        </Box>
        {!loading && (
          <DialogActions
            sx={{ mt: -5, minHeight: 45, justifyContent: 'flex-start', px: 3 }}
            disableSpacing
          >
            {/*
              * variant is named because MUI's default changed to outlined, which
              * would put a box around the locale name and make it taller. This
              * is the borderless standard variant v4 used, which is also what
              * disableUnderline applies to.
              */}
            <LocaleSelect variant="standard" disableUnderline locales={branding?.locales}/>
          </DialogActions>
        )}
      </ResponsiveDialog>
    </Grid>
  );
};

export default ResponsiveScreen;
