import { blue, blueGrey, common, red } from "@mui/material/colors";
import { alpha, createTheme } from "@mui/material/styles";

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
/* The deep end of the wash on the page, one step down from the field. */
const settle = blueGrey[100];

/*
 * 700 rather than the family's own 500, because white on 500 measures 3.12:1
 * and body text is asked for 4.5:1. White on 700 measures 4.60:1, which is what
 * lets the contrast threshold below sit at its documented default.
 */
const primaryColor = { ...blue, main: blue[700] };
const secondaryColor = blueGrey;
const errorColor = red;

/*
 * The arrangement of circles the page has carried for years, kept as data so it
 * stays readable, in the 1920x1080 box it was drawn against. Only the twelve
 * largest are used: the smaller ones crowded the lower half without adding
 * anything at this scale.
 */
const RING_BOX = { width: 1920, height: 1080 };
const RINGS = [
  { r: 359.475, cx: 746.69, cy: 499.07 },
  { r: 330.61, cx: 1758.65, cy: 829.71 },
  { r: 319.96, cx: 1455.14, cy: 182.11 },
  { r: 304.245, cx: 1453.03, cy: 791.48 },
  { r: 245.675, cx: 769.03, cy: 319.36 },
  { r: 229.51, cx: 1469.76, cy: 840.69 },
  { r: 222.61, cx: 66.93, cy: 481.38 },
  { r: 221.495, cx: 604.37, cy: 31.19 },
  { r: 192.95, cx: 228.28, cy: 23.36 },
  { r: 180, cx: 129.17, cy: 133.37 },
  { r: 180, cx: 866.4, cy: 819.73 },
  { r: 178.39, cx: 690.45, cy: 874.83 },
];

/*
 * Each circle becomes a rim: nothing in the middle, colour rising towards the
 * edge, gone again by the boundary. A rim keeps the outline this pattern has
 * always been, while a filled circle at this size reads as a smudge. The band
 * is wide and the peak sits inboard of the boundary, which is what makes the
 * edge diffuse rather than a line. The radius is in vw so the ring stays round
 * and scales with the window; the centre is a percentage of each axis, which is
 * how the arrangement survives a viewport that is not 16:9.
 */
const ringWash = (colour: string): string[] =>
  RINGS.map(
    ({ r, cx, cy }) =>
      `radial-gradient(circle ${((r / RING_BOX.width) * 100).toFixed(2)}vw at ` +
      `${((cx / RING_BOX.width) * 100).toFixed(2)}% ${((cy / RING_BOX.height) * 100).toFixed(2)}%, ` +
      `transparent 52%, ${colour} 80%, transparent 100%)`,
  );

/*
 * The theme is built rather than exported, because the page's background
 * depends on two things only the document can answer: the prefix the webapp is
 * served from, and whether the deployment dropped an image in to take the
 * background over.
 *
 * Which of the two backgrounds is emitted is decided here rather than layered
 * in CSS. Layering both would mean the deployment's image arrived over a page
 * that had already drawn its own, so a visitor on a slow link would watch one
 * replace the other; naming only the one that applies means there is nothing to
 * replace.
 *
 * createTheme is used directly rather than through adaptV4Theme: every option
 * below is still a current one. The v4 strict mode variant this replaces existed
 * because that version's theme misbehaved under StrictMode, which is no longer
 * the case.
 */
export const makeTheme = (pathPrefix: string, backgroundImage: string | null = null) =>
  createTheme({
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
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          /*
           * Attached to the viewport rather than to the document in both cases,
           * so the image covers the window and the radii and centres below are
           * measured against it, and so none of it slides when a short page
           * grows.
           */
          body: backgroundImage
            ? {
                backgroundImage: `url("${pathPrefix}/static/${backgroundImage}")`,
                backgroundSize: "cover",
                backgroundAttachment: "fixed",
                backgroundRepeat: "no-repeat",
              }
            : {
                /*
                 * The ring arrangement over a wash. The wash gathers light where
                 * the card sits and settles towards the edges, which lifts the
                 * card off the page; the rings sit on top of it and carry what
                 * the page has always looked like. Every tone stays within a
                 * hair of the field's own lightness, so none of it can compete
                 * with the card or hide a control drawn over it.
                 */
                backgroundImage: [
                  /*
                   * A whisper of the accent rather than the neutral, which is
                   * the blue the pattern was originally stroked in. The alpha is
                   * low because the band above is wide: the two together are
                   * what make a ring read as a halo rather than as a line.
                   */
                  ...ringWash(alpha(primaryColor.main, 0.09)),
                  `radial-gradient(1000px 700px at 50% 30%, ${surface} 0%, ${alpha(surface, 0.7)} 40%, ${alpha(surface, 0)} 70%)`,
                  `radial-gradient(1600px 1100px at 50% 120%, ${settle} 0%, ${alpha(settle, 0)} 70%)`,
                ].join(", "),
                backgroundAttachment: "fixed",
                backgroundRepeat: "no-repeat",
              },
        },
      },
    },
  });
