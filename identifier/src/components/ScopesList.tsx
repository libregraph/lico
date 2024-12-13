import React from "react";

import List, { ListProps } from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, WithStyles, withStyles } from "@material-ui/core/styles";
import Checkbox from "@material-ui/core/Checkbox";

import { useTranslation } from "react-i18next";

const styles = () => createStyles({
  row: {
    paddingTop: 0,
    paddingBottom: 0,
  },
});

interface ScopesListProps extends WithStyles<typeof styles> {
  scopes: string[],
  meta: {
    mapping: string[],
    definitions: { [key: string]: { [key: string]: string } }
  }
}

const ScopesList: React.FC<ScopesListProps & ListProps> = ({ scopes, meta, classes, ...rest }) => {
  const { mapping, definitions } = meta;

  const { t } = useTranslation();

  const rows = [];
  const known: { [key: string]: boolean } = {};

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
    let label;
    if (definition) {
      switch (definition.id) {
        case "scope_alias_basic":
          label = t(
            "konnect.scopeDescription.aliasBasic",
            "Access your basic account information"
          );
          break;
        case "scope_offline_access":
          label = t(
            "konnect.scopeDescription.offlineAccess",
            "Keep the allowed access persistently and forever"
          );
          break;
        default:
      }
      if (!label) {
        label = definition.description;
      }
    }
    if (!label) {
      label = t("konnect.scopeDescription.scope", "Scope: {{scope}}", {
        scope,
      });
    }

    rows.push(
      <ListItem disableGutters dense key={id} className={classes.row}>
        <Checkbox checked disableRipple disabled />
        <ListItemText primary={label} />
      </ListItem>
    );
  }

  return <List {...rest}>{rows}</List>;
};

export default withStyles(styles)(ScopesList);
