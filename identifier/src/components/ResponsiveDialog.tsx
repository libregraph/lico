import React from 'react';

import Dialog, { DialogProps } from "@material-ui/core/Dialog";
import withMobileDialog from "@material-ui/core/withMobileDialog";

const ResponsiveDialog = (props: DialogProps & { fullScreen: boolean }) => {
  return <Dialog {...props} />;
};

export default withMobileDialog()(ResponsiveDialog);
