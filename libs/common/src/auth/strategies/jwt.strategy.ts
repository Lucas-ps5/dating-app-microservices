import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";
import {
  AuthenticatedUser,
  KeycloakTokenPayload,
} from "../interfaces/authenticated-user.interface";

/**
 * Verifies Keycloak access tokens against the realm's JWKS endpoint.
 * Every service runs this so identity is established from a signed token
 * rather than trusted from a caller-supplied header.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;

  constructor(private readonly configService: ConfigService) {
    const authServerUrl =
      configService.get<string>("keycloak.authServerUrl") ??
      process.env.KEYCLOAK_AUTH_SERVER_URL;
    const realm =
      configService.get<string>("keycloak.realm") ?? process.env.KEYCLOAK_REALM;

    if (!authServerUrl || !realm) {
      throw new Error(
        "KEYCLOAK_AUTH_SERVER_URL and KEYCLOAK_REALM are required to verify tokens",
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience:
        configService.get<string>("jwt.audience") ?? process.env.JWT_AUDIENCE,
      issuer: configService.get<string>("jwt.issuer") ?? process.env.JWT_ISSUER,
      algorithms: ["RS256"],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });

    this.clientId =
      configService.get<string>("keycloak.clientId") ??
      process.env.KEYCLOAK_CLIENT_ID ??
      "";
  }

  validate(payload: KeycloakTokenPayload): AuthenticatedUser {
    // A token with no `sub` would resolve to `undefined`, which most
    // repository lookups silently treat as "no filter" and return the first
    // row. Reject it outright rather than serve another user's record.
    if (!payload.sub) {
      throw new UnauthorizedException(
        "Token is missing the sub claim. Check that the client's default scopes include 'basic'.",
      );
    }

    const realmRoles: string[] = payload.realm_access?.roles ?? [];
    const clientRoles: string[] =
      payload.resource_access?.[this.clientId]?.roles ?? [];

    return {
      id: payload.sub,
      username: payload.preferred_username || payload.email || payload.sub,
      email: payload.email,
      roles: [...realmRoles, ...clientRoles],
      realmRoles,
      clientRoles,
    };
  }
}
