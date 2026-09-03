import Fade from "@mui/material/Fade";
import LinearProgress from "@mui/material/LinearProgress";

/*
 * The page reporting that it is still busy, pinned to the top edge of the
 * viewport.
 *
 * A strip rather than a ring because of what it is drawn on. The background is
 * a scatter of thin circle outlines, so a thin ring placed on top of it is
 * camouflaged rather than merely subtle, and a horizontal line is the one shape
 * that motif has none of.
 *
 * The neutral text and divider tones are deliberate. This belongs to the page
 * and not to the deployment, and the accent would put a second brand colour
 * across the top of whatever logo the operator supplies.
 *
 * The delay is what keeps it honest: a wait which ends inside that window
 * shows nothing at all, and only one long enough to be worth reporting ever
 * reaches the screen.
 *
 * No label, because this renders before i18next has any resources and an
 * untranslated one would be worse than the role the bar already carries.
 */
const ProgressStrip = () => {
  return (
    <Fade in style={{ transitionDelay: "800ms" }} unmountOnExit>
      <LinearProgress
        sx={(theme) => ({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          zIndex: theme.zIndex.modal + 1,
          backgroundColor: theme.palette.divider,
          "& .MuiLinearProgress-bar": {
            backgroundColor: theme.palette.text.secondary,
          },
        })}
      />
    </Fade>
  );
};

export default ProgressStrip;
