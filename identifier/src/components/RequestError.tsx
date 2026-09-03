import Typography from "@mui/material/Typography";

import type { TranslatableError } from "../errors";
import { ErrorMessage } from "../errors";

export interface RequestErrorProps {
  error?: TranslatableError;
}

/*
 * The failure which belongs to the request rather than to any one field, which
 * the login slice keeps under `http`.
 *
 * Renders nothing when there is none, so the screens showing it need no
 * conditional of their own, and all of them say it the same way.
 */
const RequestError = ({ error }: RequestErrorProps) => {
  if (!error) {
    return null;
  }

  return (
    <Typography variant="subtitle2" color="error" sx={{ mt: 2, mb: 2 }}>
      <ErrorMessage error={error} />
    </Typography>
  );
};

export default RequestError;
