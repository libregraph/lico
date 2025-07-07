import React, { useEffect, useCallback, useMemo } from 'react';
import { withTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  DialogContent,
} from '@mui/material';

import { TranslationFunction } from '../../types/common';
import { LogonResponse } from '../../types/actions';
import { executeLogonIfFormValid, advanceLogonFlow } from '../../actions/login';
import { ErrorMessage } from '../../errors';
import { createHistoryWrapper } from '../../utils/history';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

interface ChooseaccountProps {
  t: TranslationFunction;
}

const listStyles = { marginLeft: -5, marginRight: -5 };
const listItemStyles = { paddingLeft: 5, paddingRight: 5 };
const errorMessageStyles = { marginTop: 2 };

const Chooseaccount: React.FC<ChooseaccountProps> = ({ t }) => {
  const { loading, errors, hello } = useAppSelector((state) => ({
    loading: state.login.loading,
    errors: state.login.errors,
    hello: state.common.hello
  }));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hello || !hello.state) {
      navigate(`/identifier${location.search}${location.hash}`, { replace: true });
    }
  }, [hello, navigate, location]);

  const logon = useCallback(
    (event: React.FormEvent | React.MouseEvent) => {
      event.preventDefault();

      if (hello) {
        dispatch(executeLogonIfFormValid(hello.username || '', '', true)).then((response: LogonResponse) => {
          if (response.success) {
            const historyWrapper = createHistoryWrapper(navigate, location);
            dispatch(advanceLogonFlow(response.success, historyWrapper));
          }
        });
      }
    },
    [dispatch, hello, navigate, location]
  );

  const logoff = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      navigate(`/identifier${location.search}${location.hash}`);
    },
    [navigate, location]
  );

  const errorMessage = useMemo(() => {
    if (errors.http) {
      return (
        <Typography color="error" sx={errorMessageStyles}>
          <ErrorMessage error={errors.http}></ErrorMessage>
        </Typography>
      );
    }
    return null;
  }, [errors.http]);

  const username = hello?.username || '';

  return (
    <DialogContent sx={{ overflowY: 'visible' }}>
      <Typography variant="h5" component="h3">
        {t("konnect.chooseaccount.headline", "Choose an account")}
      </Typography>
      <Typography variant="subtitle1" sx={{ marginBottom: 2 }}>
        {t("konnect.chooseaccount.subHeader", "to sign in")}
      </Typography>

      <form action="" onSubmit={logon}>
        <List disablePadding sx={listStyles}>
          <ListItem
            button
            disableGutters
            sx={listItemStyles}
            disabled={!!loading}
            onClick={logon}
          ><ListItemAvatar><Avatar>{username.charAt(0) || '?'}</Avatar></ListItemAvatar>
            <ListItemText primary={hello?.username || ''} />
          </ListItem>
          <ListItem
            button
            disableGutters
            sx={listItemStyles}
            disabled={!!loading}
            onClick={logoff}
          >
            <ListItemAvatar>
              <Avatar>
                {t("konnect.chooseaccount.useOther.persona.label", "?")}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                t("konnect.chooseaccount.useOther.label", "Use another account")
              }
            />
            </ListItem>
          </List>

          {errorMessage}
        </form>
      </DialogContent>
    );
};

export default withTranslation()(Chooseaccount);
