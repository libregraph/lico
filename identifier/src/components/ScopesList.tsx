
import type React from 'react';

import List from '@mui/material/List';
import type { ListProps } from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';

import { useTranslation } from 'react-i18next';

import type { ScopesMeta } from '../models/api';

const rowSx = { pt: 0, pb: 0 };

export interface ScopesListProps extends ListProps {
  // The granted flags of a hello response, keyed by OIDC scope name.
  scopes: Record<string, boolean>;
  meta: ScopesMeta;
}

const ScopesList = ({scopes, meta, ...rest}: ScopesListProps) => {
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
        sx={rowSx}
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

export default ScopesList;
