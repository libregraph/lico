import React from 'react';

import {
  Fade,
  CircularProgress,
  Box,
 } from '@mui/material';

const Spinner = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <Fade
        in
        style={{
          transitionDelay: '800ms',
        }}
        unmountOnExit
      >
        <CircularProgress size={70} thickness={1}/>
      </Fade>
    </Box>
  );
}

export default Spinner;
