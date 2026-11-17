import { useTranslation } from "react-i18next";

import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import BusyButton from "../../components/BusyButton";
import RequestError from "../../components/RequestError";
import { ErrorMessage } from "../../errors";
import { useAppSelector } from "../../hooks/redux";
import { selectErrors, selectLoading } from "../../reducers/login";

interface SecondFactorProps {
  code: string;
  onCodeChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: React.SyntheticEvent) => void;
  onBack: () => void;
}

/*
 * The second step of the logon, for users with a second factor: the code of
 * their authenticator app. The login screen owns the code, because it is sent
 * together with the credentials of the first step.
 */
function SecondFactor({ code, onCodeChange, onSubmit, onBack }: SecondFactorProps) {
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  const { t } = useTranslation();

  return (
    <DialogContent>
      <Typography variant="h5" component="h3" gutterBottom>
        {t("konnect.login.secondFactor.headline", "Two-factor authentication")}
      </Typography>
      <Typography variant="body2" gutterBottom>
        {t("konnect.login.secondFactor.text", "Enter the code from your authenticator app.")}
      </Typography>

      <form action="" onSubmit={onSubmit}>
        <TextField
          label={t("konnect.login.codeField.label", "Code")}
          error={!!errors.code}
          helperText={<ErrorMessage error={errors.code}></ErrorMessage>}
          fullWidth
          autoFocus
          slotProps={{
            htmlInput: {
              autoCapitalize: "off",
              spellCheck: "false",
            },
          }}
          value={code}
          onChange={onCodeChange}
          autoComplete="one-time-code"
          variant="outlined"
          sx={{ mt: 1, mb: 1.5 }}
        />
        <DialogActions>
          <Button color="secondary" disabled={!!loading} onClick={onBack}>
            {t("konnect.login.backButton.label", "Back")}
          </Button>
          <BusyButton
            type="submit"
            color="primary"
            variant="contained"
            disabled={!!loading}
            busy={!!loading}
            onClick={onSubmit}
          >
            {t("konnect.login.verifyButton.label", "Verify")}
          </BusyButton>
        </DialogActions>

        <RequestError error={errors.http} />
      </form>
    </DialogContent>
  );
}

export default SecondFactor;
