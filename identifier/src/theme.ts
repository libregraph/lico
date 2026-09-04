import { blue, blueGrey, common, red } from "@mui/material/colors";
import { createTheme } from "@mui/material/styles";

/*
 * Two surfaces and one accent, every value a step of a palette this file
 * already imports rather than a literal, so the set stays a family instead of
 * drifting into assorted values nobody can place.
 *
 * The neutrals are all blueGrey, which is the secondary colour below, so the
 * page and the type belong to the same family as the rest of the theme. The
 * card stays pure white, because an operator's logo was drawn for that
 * background, and the page behind it takes the palest step of the family: a
 * cool near-grey, which is what lets the card read as a document on a field
 * rather than as white on white.
 *
 * Ratios against the card, which is where all of the text sits: ink 13.16:1,
 * muted 5.40:1. Both clear the 4.5:1 asked of body text.
 */
const field = blueGrey[50];
const surface = common.white;
const ink = blueGrey[900];
const inkMuted = blueGrey[600];

/*
 * 700 rather than the family's own 500, because white on 500 measures 3.12:1
 * and body text is asked for 4.5:1. White on 700 measures 4.60:1, which is what
 * lets the contrast threshold below sit at its documented default.
 */
const primaryColor = { ...blue, main: blue[700] };
const secondaryColor = blueGrey;
const errorColor = red;

/*
 * createTheme is used directly rather than through adaptV4Theme: every option
 * below is still a current one. The v4 strict mode variant this replaces existed
 * because that version's theme misbehaved under StrictMode, which is no longer
 * the case.
 */
const theme = createTheme({
  palette: {
    primary: primaryColor,
    secondary: secondaryColor,
    error: errorColor,
    // CssBaseline paints default onto the body, which is the field: the element
    // behind the card in index.html has no height of its own to paint.
    background: {
      default: field,
      paper: surface,
    },
    text: {
      primary: ink,
      secondary: inkMuted,
    },
    // Used by `getContrastText()` to maximize the contrast between the background and
    // the text.
    contrastThreshold: 3,
    // Used to shift a color's luminance by approximately
    // two indexes within its tonal palette.
    // E.g., shift from Red 500 to Red 300 or Red 700.
    tonalOffset: 0.2,
  },
  typography: {
    /*
     * Sizes in rem rather than px, so a reader who has raised their browser's
     * font size gets larger text instead of having the choice overridden. The
     * pixel value in each comment is what the size renders at the default root
     * of 16. Variants not named here keep the library's own sizes.
     */
    h5: {
      fontSize: "1.5rem", // 24px
      lineHeight: 1.2,
      fontWeight: 500,
    },
    subtitle1: {
      fontSize: "0.9375rem", // 15px
      lineHeight: 1.5,
    },
    body1: {
      fontSize: "0.9375rem", // 15px
      lineHeight: 1.55,
    },
    body2: {
      fontSize: "0.8125rem", // 13px
      lineHeight: 1.5,
    },
    button: {
      textTransform: "none",
    },
  },
});

export default theme;
