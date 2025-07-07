import React from 'react';

import {
  Fade,
  CircularProgress,
  Box,
} from '@mui/material';

const boxStyles = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

const fadeStyles = {
  transitionDelay: '800ms',
};

const Spinner = () => {
  return (
    <Box sx={boxStyles}>
      <Fade
        in
        style={fadeStyles}
        unmountOnExit
      >
        <CircularProgress size={70} thickness={1}/>
      </Fade>
    </Box>
  );
};

export default Spinner;
