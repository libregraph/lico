import React from 'react';
import classNames from "classnames";

import { createStyles, Theme, WithStyles, withStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";

import ResponsiveDialog from "./ResponsiveDialog";
import Logo from "../images/app-icon.svg";
import Loading from "./Loading";
import LocaleSelect from "./LocaleSelect";
import { ReactNode } from "react";
import { DialogProps, PaperProps } from "@material-ui/core";

const styles = (theme: Theme) => createStyles({
  root: {
    display: "flex",
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 12,
    minHeight: 350,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    position: "relative",
  },
  dialog: {
    maxWidth: 440,
  },
  logo: {
    height: 24,
  },
  actions: {
    marginTop: -40,
    minHeight: 45,
    justifyContent: "flex-start",
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
});


interface ResponsiveScreenProps extends WithStyles<typeof styles> {
  withoutLogo?: boolean,
  withoutPadding?: boolean,
  loading?: boolean,
  branding?: { bannerLogo: string, locales: string[] } | null,
  children: ReactNode,
  className?: string,
  PaperProps?: PaperProps,
  DialogProps?: DialogProps,
}

const ResponsiveScreen: React.FC<ResponsiveScreenProps> = (props) => {
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
  const logo = withoutLogo ? null : (
    <DialogContent>
      <img src={bannerLogoSrc} className={classes.logo} alt="" />
    </DialogContent>
  );

  const LoadingComponent = Loading as React.FC;

  const content = loading ? (
    <LoadingComponent />
  ) : withoutPadding ? (
    children
  ) : (
    <DialogContent>{children}</DialogContent>
  );

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      spacing={0}
      className={classNames(classes.root, className)}
      {...other}
    >
      <ResponsiveDialog
        {...DialogProps}
        open
        fullWidth
        maxWidth="sm"
        disableEscapeKeyDown
        hideBackdrop
        PaperProps={{ elevation: 4, ...PaperProps }}
        classes={{
          paperWidthSm: classes.dialog,
        }}
      >
        <div className={classes.content}>
          {logo}
          {content}
        </div>
        {!loading && (
          <DialogActions className={classes.actions} disableSpacing>
            <LocaleSelect disableUnderline locales={branding?.locales} />
          </DialogActions>
        )}
      </ResponsiveDialog>
    </Grid>
  );
};

export default withStyles(styles)(ResponsiveScreen);
