import React from 'react';

interface Client {
  id: string;
  display_name?: string;
}

interface ClientDisplayNameProps {
  client: Client;
  [key: string]: unknown;
}

const ClientDisplayName: React.FC<ClientDisplayNameProps> = ({ client, ...rest }) => (
  <span {...rest}>{client.display_name ? client.display_name : client.id}</span>
);

export default ClientDisplayName;
