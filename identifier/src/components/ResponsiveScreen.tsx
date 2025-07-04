import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {
  Grid,
  DialogActions,
  DialogContent,
  Box,
} from '@mui/material';

import ResponsiveDialog from './ResponsiveDialog';
import Logo from '../images/app-icon.svg';
import Loading from './Loading';
import LocaleSelect from './LocaleSelect';

const ResponsiveScreen = (props: any) => {
  const {
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
  const logo = withoutLogo ? null :
    <DialogContent><img src={bannerLogoSrc} style={{ height: 24 }} alt=""/></DialogContent>;

  const content = loading ? <Loading/> : (withoutPadding ? children : <DialogContent>{children}</DialogContent>);

  return (
    <Grid 
      container 
      justifyContent="center" 
      alignItems="center" 
      spacing={0}
      className={classNames(className)}
      sx={{ display: 'flex', flex: 1 }}
      {...other}
    >
      <ResponsiveDialog 
        open 
        fullWidth 
        maxWidth="sm" 
        disableEscapeKeyDown 
        hideBackdrop
        {...DialogProps}
        PaperProps={{elevation: 4, ...PaperProps}}
        sx={{ '& .MuiDialog-paperWidthSm': { maxWidth: 440 } }}
      >
        <Box
          sx={{
            paddingTop: 3,
            paddingBottom: 1.5,
            minHeight: 350,
            paddingLeft: 2,
            paddingRight: 2,
            position: 'relative'
          }}
        >
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
            sx={{ 
              marginTop: -5, 
              minHeight: 45, 
              justifyContent: 'flex-start', 
              paddingLeft: 3, 
              paddingRight: 3 
            }} 
            disableSpacing
          >
            <LocaleSelect locales={branding?.locales}/>
          </DialogActions>
        )}
      </ResponsiveDialog>
    </Grid>
  );
};


ResponsiveScreen.propTypes = {
  withoutLogo: PropTypes.bool,
  withoutPadding: PropTypes.bool,
  loading: PropTypes.bool,
  branding: PropTypes.object,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  PaperProps: PropTypes.object,
  DialogProps: PropTypes.object
};

export default ResponsiveScreen;
