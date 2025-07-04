import React from 'react';
import PropTypes from 'prop-types';
import { useMediaQuery, useTheme } from '@mui/material';
import { Dialog } from '@mui/material';

const ResponsiveDialog = (props: any) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  
  return <Dialog fullScreen={fullScreen} {...props}/>;
};

ResponsiveDialog.propTypes = {
  children: PropTypes.node
};

export default ResponsiveDialog;
