import { useRef } from "react";
import { useTranslation } from "react-i18next";

import KeyOutlined from "@mui/icons-material/KeyOutlined";
import Avatar from "@mui/material/Avatar";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { advanceLogonFlow, executeLogonIfFormValid } from "../../actions/login";
import RequestError from "../../components/RequestError";
import { useFlowNavigation, useRedirectUnlessPushed } from "../../hooks/navigation";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectHello } from "../../reducers/common";
import { selectErrors, selectLoading } from "../../reducers/login";
import { withSearchAndHash } from "../../utils";

/*
 * Both rows, so the padding, the height and the focus ring are declared once
 * rather than repeated as an sx object on each.
 *
 * The height is fixed for both because only one of them carries two lines of
 * text: left to the content, the account would stand 71px against the other's
 * 56 and the pair would look mismatched. It also stops the row changing size
 * depending on whether the session happens to carry a display name.
 *
 * The ring is the point of the rest: these are the two things a keyboard
 * operates on this screen, and MUI marks focus with a 12% black wash alone,
 * which measures 1.24:1 against the card. The accent is the colour the
 * credential field already focuses in. Inset by its own width, because the rows
 * run to the card's edges and an outline drawn outside them would be clipped.
 */
const AccountRow = styled(ListItemButton)(({ theme }) => ({
  minHeight: theme.spacing(9),
  paddingLeft: theme.spacing(5),
  paddingRight: theme.spacing(5),
  "&.Mui-focusVisible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
}));

function Chooseaccount() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const nav = useFlowNavigation();
  const hello = useAppSelector(selectHello);
  const loading = useAppSelector(selectLoading);
  const errors = useAppSelector(selectErrors);

  // A visitor without a session has nothing to choose between.
  const redirecting = useRedirectUnlessPushed(!hello?.state);

  // Both the form and the account entry reach this, so the event is only ever
  // used to stop the default submission.
  const handleLogon = (event: React.SyntheticEvent) => {
    event.preventDefault();

    // The mount guard sends a visitor without a session away, so a name is
    // present by the time this can be reached. Validation reports an empty one
    // rather than this throwing if that ever stops holding.
    dispatch(executeLogonIfFormValid(hello?.username ?? "", "", true)).then((response) => {
      if (response.success) {
        dispatch(advanceLogonFlow(response.success, nav));
      }
    });
  };

  const handleLogoff = (event: React.SyntheticEvent) => {
    event.preventDefault();

    nav.navigate(withSearchAndHash("/identifier", nav.location));
  };

  /*
   * A list of choices is walked with the arrows, so up and down move between
   * the rows; Tab still leaves the list entirely. It wraps, so either key
   * reaches the other row from either end, and preventDefault stops the page
   * scrolling underneath instead.
   */
  const rows = useRef<(HTMLElement | null)[]>([]);
  const handleArrows = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const present = rows.current.filter((row): row is HTMLElement => row !== null);
    const at = present.indexOf(document.activeElement as HTMLElement);

    // Arrows pressed somewhere else in the list are not ours to swallow.
    if (at < 0) {
      return;
    }

    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    present[(at + step + present.length) % present.length].focus();
  };

  // Nothing to show while the guard above is sending the visitor away.
  if (redirecting) {
    return null;
  }

  const username = hello?.state ? (hello.username ?? "") : "";
  const displayName = hello?.state ? (hello.displayName ?? "") : "";

  /*
   * Taken from whichever of the two the row leads with, so the letter always
   * labels the line beside it. Upper case because an initial is one, and MUI
   * prints whatever case it is given.
   *
   * Array.from, not slice: a name beginning with an astral character indexes as
   * two code units, and slicing one of them off leaves a lone surrogate that
   * renders as a replacement glyph. Nothing here needs a library — a single
   * initial has nothing to split, which is the only part of a name that is hard.
   */
  const initial = (Array.from((displayName || username).trim())[0] ?? "").toUpperCase();

  return (
    <DialogContent sx={{ overflowY: "visible" }}>
      <Typography variant="h5" component="h3">
        {t("konnect.chooseaccount.headline", "Choose an account")}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {t("konnect.chooseaccount.subHeader", "to sign in")}
      </Typography>

      <form action="" onSubmit={handleLogon}>
        <List disablePadding onKeyDown={handleArrows} sx={{ ml: -5, mr: -5 }}>
          <ListItem disableGutters disablePadding>
            {/*
             * The account the visitor already has is the answer this screen
             * expects, so it holds the focus on arrival and Enter takes it
             * without a pointer. Either arrow, or Tab, reaches the other
             * option. Login.tsx does this with its username field.
             */}
            <AccountRow
              autoFocus
              ref={(row) => {
                rows.current[0] = row;
              }}
              disabled={!!loading}
              onClick={handleLogon}
            >
              <ListItemAvatar>
                {/*
                 * A filled circle is a who. MUI's letter avatar sets its text
                 * colour from palette.background.default, which is this app's
                 * field colour, so the default is near-white on mid grey at
                 * 1.63:1 — and its grey is the one neutral outside the family
                 * §5C settled on.
                 */}
                <Avatar aria-hidden="true" sx={{ bgcolor: "secondary.dark", color: "common.white" }}>
                  {initial}
                </Avatar>
              </ListItemAvatar>
              {/*
               * The person's own name leads and the address identifies it,
               * because two accounts can carry the same name and the address is
               * what tells them apart. A session with no name to show falls
               * back to one line rather than leaving a blank one.
               */}
              <ListItemText primary={displayName || username} secondary={displayName ? username : null} />
            </AccountRow>
          </ListItem>
          <ListItem disableGutters disablePadding>
            <AccountRow
              ref={(row) => {
                rows.current[1] = row;
              }}
              disabled={!!loading}
              onClick={handleLogoff}
            >
              <ListItemAvatar>
                {/*
                 * An outlined circle is a what-you-can-do, so the row reads as an
                 * action rather than a second account, and the glyph inside it is
                 * outline only to match. A key, because the row leads to signing
                 * in as somebody else rather than to adding a person to a list. It
                 * replaces a "?", which meant unknown or help, and which was
                 * carried as a translated string in every locale.
                 *
                 * The outline and the glyph take the colour the row above fills
                 * its circle with, so the two avatars are one family and differ
                 * only in being filled or not. MUI's divider, which this started
                 * with, is a 12% black that all but disappears on the card.
                 *
                 * fontSize inherit, so the glyph is set at the same type size the
                 * avatar gives the initial above rather than at one of the icon
                 * presets, and stays that way if the avatar changes.
                 */}
                <Avatar
                  sx={{ bgcolor: "transparent", color: "secondary.dark", border: 1, borderColor: "secondary.dark" }}
                >
                  <KeyOutlined fontSize="inherit" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={t("konnect.chooseaccount.useOther.label", "Use another account")} />
            </AccountRow>
          </ListItem>
        </List>

        <RequestError error={errors.http} />
      </form>
    </DialogContent>
  );
}

export default Chooseaccount;
