
import Dialog from '@material-ui/core/Dialog';
import type { DialogProps } from '@material-ui/core/Dialog';
import withMobileDialog from '@material-ui/core/withMobileDialog';

// fullScreen is required here because withMobileDialog always injects it.
export interface ResponsiveDialogProps extends DialogProps {
  fullScreen: boolean;
}

const ResponsiveDialog = (props: ResponsiveDialogProps) => {
  return <Dialog {...props}/>;
};

export default withMobileDialog()(ResponsiveDialog);
