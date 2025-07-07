import React, { ReactNode } from 'react';
import { useMediaQuery, useTheme, DialogProps, Dialog } from '@mui/material';

interface ResponsiveDialogProps extends DialogProps {
  children?: ReactNode;
}

const ResponsiveDialog: React.FC<ResponsiveDialogProps> = (props) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  
  return <Dialog fullScreen={fullScreen} {...props}/>;
};

export default ResponsiveDialog;
