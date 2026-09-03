import Box from "@mui/material/Box";
import type { ButtonProps } from "@mui/material/Button";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { green } from "@mui/material/colors";

/*
 * The indicator is centred over the button by absolute positioning, so the
 * offsets are half of its 24px size given in spacing units rather than as
 * spacing steps of their own.
 */
const progressSx = {
  color: green[500],
  position: "absolute",
  top: "50%",
  left: "50%",
  mt: -1.5,
  ml: -1.5,
} as const;

/*
 * Exists only to position the indicator. Any margin around the button belongs
 * to whatever lays the buttons out, not here.
 */
const wrapperSx = {
  position: "relative",
  display: "inline-block",
} as const;

export interface BusyButtonProps extends ButtonProps {
  /*
   * Whether this button's own request is in flight. Separate from disabled,
   * because a screen offering two of these disables both while the indicator
   * belongs on the one that was pressed.
   */
  busy?: boolean;
}

/*
 * A button which shows progress over itself rather than in place of itself, so
 * that starting a request does not move everything below it.
 */
const BusyButton = ({ busy = false, children, ...other }: BusyButtonProps) => (
  <Box sx={wrapperSx}>
    <Button sx={{ m: 1, minWidth: 100 }} {...other}>
      {children}
    </Button>
    {busy && <CircularProgress size={24} sx={progressSx} />}
  </Box>
);

export default BusyButton;
