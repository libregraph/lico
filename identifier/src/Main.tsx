import React from 'react';
import { useSelector } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Box } from '@mui/material';
import { RootState } from './reducers/index';

import Routes from './Routes';

const Main: React.FC = () => {
  const { hello, pathPrefix } = useSelector((state: RootState) => ({
    hello: state.common.hello,
    pathPrefix: state.common.pathPrefix
  }));

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flex: 1
      }}
    >
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello}/>
      </BrowserRouter>
    </Box>
  );
};

export default Main;
