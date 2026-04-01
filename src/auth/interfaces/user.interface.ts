export interface KeycloakUser {
  sub: string; // User ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email?: string;
  roles: string[];
  realmRoles: string[];
  clientRoles: string[];
}
