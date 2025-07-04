import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Checkbox,
} from '@mui/material';

import { useTranslation } from 'react-i18next';

interface Scope {
  [key: string]: boolean;
}

interface Meta {
  mapping: Record<string, string>;
  definitions: Record<string, any>;
}

interface ScopesListProps {
  scopes: Scope;
  meta: Meta;
  [key: string]: any;
}

const ScopesList: React.FC<ScopesListProps> = ({scopes, meta, ...rest}) => {
  const { mapping, definitions } = meta;

  const { t } = useTranslation();

  const rows: React.ReactNode[] = [];
  const known: Record<string, boolean> = {};

  // TODO(longsleep): Sort scopes according to priority.
  for (const scope in scopes) {
    if (!scopes[scope]) {
      continue;
    }
    let id = mapping[scope];
    if (id) {
      if (known[id as string]) {
        continue;
      }
      known[id as string] = true;
    } else {
      id = scope;
    }
    const definition = definitions[id as string];
    let label;
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
        sx={{ paddingTop: 0, paddingBottom: 0 }}
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
