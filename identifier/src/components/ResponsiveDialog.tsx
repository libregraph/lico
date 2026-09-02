import type { DialogProps } from "@mui/material/Dialog";
import Dialog from "@mui/material/Dialog";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

/*
 * A dialog which fills the screen on a small viewport. This replaces v4's
 * withMobileDialog, which was removed, and keeps that helper's default
 * breakpoint: it went full screen below sm, so the query is the sm breakpoint
 * pointing down.
 *
 * fullScreen stays overridable, because Dialog accepts it and a caller asking
 * for a particular value should win over the viewport.
 */
const ResponsiveDialog = (props: DialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return <Dialog fullScreen={fullScreen} {...props} />;
};

export default ResponsiveDialog;
