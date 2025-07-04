import { createTheme } from '@mui/material/styles';

import { blueGrey, blue, red } from '@mui/material/colors';

const primaryColor = blue;
const secondaryColor = blueGrey;
const errorColor = red;

// All the following keys are optional.
// We try our best to provide a great default value.
const theme = createTheme({
  palette: {
    primary: primaryColor,
    secondary: secondaryColor,
    error: errorColor,
    // Used by `getContrastText()` to maximize the contrast between the background and
    // the text.
    // NOTE(longsleep): KopanoBlue is too light and thus needs 2.4 contrastThreshold
    // to make sure the default 500 color is still using white text. It will
    // show warnings in development mode that the contrast is too low as W3C
    // recommends the threshold to be 3 or more. This cannot be helped.
    contrastThreshold: 2.4,
    // Used to shift a color's luminance by approximately
    // two indexes within its tonal palette.
    // E.g., shift from Red 500 to Red 300 or Red 700.
    tonalOffset: 0.2,
  },
  typography: {
    fontSize: 12,
    button: {
      textTransform: 'none',
    },
  },
});

export default theme;
