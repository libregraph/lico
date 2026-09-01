import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';

const Spinner = () => {
  return <Box sx={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
    <Fade
      in
      style={{
        transitionDelay: '800ms',
      }}
      unmountOnExit
    >
      <CircularProgress size={70} thickness={1}/>
    </Fade>
  </Box>;
}

export default Spinner;
