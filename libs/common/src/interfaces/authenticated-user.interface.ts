export interface AuthenticatedUser {
  userId: string;
  username: string;
  email?: string;
  roles: string[];
  realmRoles: string[];
  clientRoles: string[];
}
