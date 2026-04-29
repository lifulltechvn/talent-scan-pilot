export interface User {
  id: string;
  email: string;
  fullName?: string;
  full_name?: string;
  isActive?: boolean;
  is_active?: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
