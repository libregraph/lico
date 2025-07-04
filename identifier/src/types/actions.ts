export interface ActionResponse {
  success: boolean;
  errors?: Record<string, any>;
  state?: string;
}

export interface LogonResponse extends ActionResponse {
  username?: string;
}

export interface ConsentResponse extends ActionResponse {
  state?: string;
}