import React from 'react';

export interface ClientDisplayNameProps extends React.HTMLAttributes<HTMLSpanElement> {
  client: { [key: string]: string },
}


const ClientDisplayName: React.FC<ClientDisplayNameProps> = ({ client, ...rest }) => (
  <span {...rest}>{client.display_name ? client.display_name : client.id}</span>
);

export default ClientDisplayName;
