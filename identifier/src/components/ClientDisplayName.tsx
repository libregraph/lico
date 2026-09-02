import type React from "react";

import type { ClientDetails } from "../models/api";

export interface ClientDisplayNameProps extends React.HTMLAttributes<HTMLSpanElement> {
  client: ClientDetails;
}

const ClientDisplayName = ({ client, ...rest }: ClientDisplayNameProps) => (
  <span {...rest}>{client.display_name ? client.display_name : client.id}</span>
);

export default ClientDisplayName;
