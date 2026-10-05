/**
 * Shape of the identity attached to `request.user` once a JWT has been
 * verified. Shared by the gateway and every backend service so they all agree
 * on how a caller is identified.
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  realmRoles: string[];
  clientRoles: string[];
}

/**
 * Minimal shape of the Express request as seen by our guards and decorators.
 * Typed so we never reach into an untyped `any` request object.
 */
export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * The subset of the Keycloak access-token claims we rely on.
 */
export interface KeycloakTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}
