import type React from "react";

import Box from "@mui/material/Box";
import type { DialogProps as MuiDialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import type { GridProps } from "@mui/material/Grid";
import Grid from "@mui/material/Grid";

import Logo from "../images/app-icon.svg";
import type { Branding } from "../models/api";
import Loading from "./Loading";
import LocaleSelect from "./LocaleSelect";
import ResponsiveDialog from "./ResponsiveDialog";

/*
 * The three logo heights the branding may ask for, in pixels. These are not
 * spacing units, so they are handed to sx unscaled.
 */
const logoHeights: Record<string, number> = {
  small: 12,
  normal: 24,
  big: 48,
};

/*
 * The card holds its place across the whole flow, so the logo and the heading
 * stay put as the visitor moves from sign-in to a second factor to consent to
 * welcome. Two constants do that together.
 *
 * CARD_FLOOR is the smallest the card may be, and it has to stay above the
 * tallest ordinary screen, otherwise that screen sets its own height. The floor
 * is applied to the content box rather than to the card, so the card measures
 * `content + 45 - 40` once the actions row and its negative margin are counted.
 * The two numbers move together.
 *
 * CARD_TOP places the card's top edge, and it is computed from the floor rather
 * than from the card's real height so that the edge cannot move when a screen is
 * taller than the floor: such a screen grows downward instead of dragging the
 * logo up. Centring is what this replaces, because centring turns any change in
 * height into half as much change in position. The 113px is the upward lift
 * needed to sit a card of this size where the eye expects it, and the further
 * 32px is the card's own margin.
 *
 * The second term is a ceiling, and a tall portrait tablet is what needs it.
 * Half the viewport height is in the first term, so on its own it sinks the card
 * as the screen grows: a viewport 1366 tall would put 370px of nothing above a
 * 400px card. Holding the offset to a share of the height instead keeps the
 * proportion roughly what it is on a laptop. It also leaves the card high enough
 * that a touch keyboard, which takes the lower half of the screen and which this
 * deliberately does not reflow for, has less chance of covering it.
 */
const CARD_FLOOR = 400;
const CARD_CONTENT_FLOOR = 395;
const CARD_TOP = `max(0px, min(calc((100vh - ${CARD_FLOOR}px) / 2 - 145px), calc(18vh - 32px)))`;

export interface ResponsiveScreenProps extends Omit<GridProps, "classes" | "className" | "children"> {
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
  const logoHeight = (branding?.bannerLogoHeight && logoHeights[branding.bannerLogoHeight]) || logoHeights.normal;
  const logo = withoutLogo ? null : (
    <DialogContent>
      <Box component="img" src={bannerLogoSrc} sx={{ height: logoHeight }} alt="" />
    </DialogContent>
  );

  const content = loading ? <Loading /> : withoutPadding ? children : <DialogContent>{children}</DialogContent>;

  return (
    <Grid
      container
      spacing={0}
      sx={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center" }}
      className={className}
      {...other}
    >
      {/*
       * v4's disableEscapeKeyDown is gone and needs no replacement: this dialog
       * is given no onClose, and a Modal never closes itself, so escape had
       * nothing to call even before the prop was removed.
       */}
      <ResponsiveDialog
        open
        fullWidth
        maxWidth="sm"
        hideBackdrop
        {...DialogProps}
        slotProps={{
          // v4 reached the same width by overriding the paperWidthSm class.
          paper: { elevation: 4, sx: { maxWidth: 440 } },
          container: {
            sx: (theme) => ({
              /*
               * Only while the dialog is still a card. Below sm it is a
               * fullscreen sheet whose content is already anchored to the top,
               * so it needs no offset and a padding here would push it off the
               * bottom. The query is the exact complement of the one
               * ResponsiveDialog switches on.
               */
              [theme.breakpoints.up("sm")]: {
                alignItems: "flex-start",
                /*
                 * Edge 18 is a plugin-legacy target and has no CSS max(), so it
                 * keeps this fixed offset and every other engine takes the
                 * declaration below.
                 */
                paddingTop: "8vh",
                "@supports (padding-top: max(0px, 1px))": {
                  paddingTop: CARD_TOP,
                },
              },
            }),
          },
        }}
      >
        <Box sx={{ pt: 3, pb: 1.5, minHeight: CARD_CONTENT_FLOOR, px: 2, position: "relative" }}>
          {branding?.signinPageLogoURI ? (
            <a href={branding.signinPageLogoURI} target="_blank" rel="noopener noreferrer">
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
              mt: -5,
              minHeight: 45,
              justifyContent: "flex-start",
              // Lines this row up with the content above it, which sits at the
              // content box's px of 2 plus DialogContent's own 24px.
              px: 5,
            }}
            disableSpacing
          >
            {/*
             * variant is named because MUI's default changed to outlined, which
             * would put a box around the locale name and make it taller. This
             * is the borderless standard variant v4 used, which is also what
             * disableUnderline applies to.
             */}
            <LocaleSelect variant="standard" disableUnderline locales={branding?.locales} />
          </DialogActions>
        )}
      </ResponsiveDialog>
    </Grid>
  );
};

export default ResponsiveScreen;
