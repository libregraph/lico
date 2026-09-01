import { BrowserRouter } from 'react-router-dom';

import Box from '@mui/material/Box';

import Routes from './Routes';
import { useAppSelector } from './hooks/redux';

function Main() {
  const hello = useAppSelector(state => state.common.hello);
  const pathPrefix = useAppSelector(state => state.common.pathPrefix);

  return (
    <Box sx={{ position: 'relative', display: 'flex', flex: 1 }}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello}/>
      </BrowserRouter>
    </Box>
  );
}

export default Main;
