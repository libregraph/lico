import type React from "react";
import { useTranslation } from "react-i18next";

import type { ListProps } from "@mui/material/List";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { styled } from "@mui/material/styles";

import type { ScopesMeta } from "../models/api";

/*
 * A bullet, because each row states a fact rather than offering a choice. The
 * grant is every requested scope or none of them, decided by Allow and Cancel,
 * and this list is never read back.
 *
 * It is a styled component rather than an sx object because every row needs one:
 * styled builds the class once, where sx rebuilds the same rule per row.
 */
const Bullet = styled("span")(({ theme }) => ({
  flex: "0 0 auto",
  alignSelf: "flex-start",
  width: 4,
  height: 4,
  marginTop: 8,
  marginRight: 12,
  borderRadius: "50%",
  backgroundColor: theme.palette.text.secondary,
}));

/*
 * Offline access is how long everything else lasts rather than another thing to
 * be read, so it is stated last and in the weight the headings use. The server
 * marshals the scopes as a JSON object, whose keys arrive sorted, so ending up
 * last has to be deliberate.
 */
const OFFLINE_ACCESS_ID = "scope_offline_access";

export interface ScopesListProps extends ListProps {
  // The granted flags of a hello response, keyed by OIDC scope name.
  scopes: Record<string, boolean>;
  meta: ScopesMeta;
}

const ScopesList = ({ scopes, meta, ...rest }: ScopesListProps) => {
  const { mapping, definitions } = meta;

  const { t } = useTranslation();

  const rows: React.ReactElement[] = [];
  let persistentRow: React.ReactElement | null = null;
  const known: Record<string, boolean> = {};

  // TODO(longsleep): Sort scopes according to priority.
  for (const scope in scopes) {
    if (!scopes[scope]) {
      continue;
    }
    let id = mapping[scope];
    if (id) {
      if (known[id]) {
        continue;
      }
      known[id] = true;
    } else {
      id = scope;
    }
    const definition = definitions[id];
    let label: string | undefined;
    if (definition) {
      switch (definition.id) {
        case "scope_alias_basic":
          label = t("konnect.scopeDescription.aliasBasic", "Access your basic account information");
          break;
        case OFFLINE_ACCESS_ID:
          /*
           * Word for word what Entra shows for the same scope. The wording it
           * replaces claimed the access lasted "persistently and forever",
           * which said one thing twice and was untrue: it lasts until it is
           * taken away.
           */
          label = t("konnect.scopeDescription.offlineAccess", "Maintain access to data you have given it access to");
          break;
        default:
      }
      if (!label) {
        label = definition.description;
      }
    }
    if (!label) {
      label = t("konnect.scopeDescription.scope", "Scope: {{scope}}", { scope });
    }

    const persistent = definition?.id === OFFLINE_ACCESS_ID;

    /*
     * Indented by one of MUI's own list gutters, and on the left only: the
     * bullets step in from the sentence they complete, while the labels keep
     * the same right edge as every other line in the card.
     *
     * The padding is all there is to give: a row is a 19.5px line box, so that
     * is the floor on the pitch whatever the padding does.
     */
    const row = (
      <ListItem disableGutters dense key={id} sx={[{ pl: 2, pr: 0, py: 0.125 }, persistent && { mt: 1 }]}>
        <Bullet aria-hidden="true" />
        <ListItemText
          primary={label}
          sx={[{ my: 0 }, persistent && { "& .MuiListItemText-primary": { fontWeight: 500 } }]}
        />
      </ListItem>
    );

    if (persistent) {
      persistentRow = row;
    } else {
      rows.push(row);
    }
  }

  if (persistentRow) {
    rows.push(persistentRow);
  }

  return <List {...rest}>{rows}</List>;
};

export default ScopesList;
