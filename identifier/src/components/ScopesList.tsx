
import type React from 'react';

import List from '@material-ui/core/List';
import type { ListProps } from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import { createStyles, withStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';

import { useTranslation } from 'react-i18next';

import type { ScopesMeta } from '../models/api';

const styles = () => createStyles({
  row: {
    paddingTop: 0,
    paddingBottom: 0
  }
});

export interface ScopesListProps extends Omit<ListProps, 'classes'> {
  classes: {
    row: string;
  };

  // The granted flags of a hello response, keyed by OIDC scope name.
  scopes: Record<string, boolean>;
  meta: ScopesMeta;
}

const ScopesList = ({scopes, meta, classes, ...rest}: ScopesListProps) => {
  const { mapping, definitions } = meta;

  const { t } = useTranslation();

  const rows: React.ReactElement[] = [];
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
        case 'scope_alias_basic':
          label = t("konnect.scopeDescription.aliasBasic", "Access your basic account information");
          break;
        case 'scope_offline_access':
          label = t("konnect.scopeDescription.offlineAccess", "Keep the allowed access persistently and forever");
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

    rows.push(
      <ListItem
        disableGutters
        dense
        key={id}
        className={classes.row}
      ><Checkbox
          checked
          disableRipple
          disabled
        />
        <ListItemText primary={label} />
      </ListItem>
    );
  }

  return (
    <List {...rest}>
      {rows}
    </List>
  );
};

export default withStyles(styles)(ScopesList);
