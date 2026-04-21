import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";
import { AuthenticatedUser, KeycloakUser } from "../interfaces/user.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;

  constructor(private configService: ConfigService) {
    const authServerUrl = configService.get<string>("keycloak.authServerUrl");
    const realm = configService.get<string>("keycloak.realm");

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: configService.get<string>("jwt.audience"),
      issuer: configService.get<string>("jwt.issuer"),
      algorithms: ["RS256"],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
    this.clientId = configService.get<string>("keycloak.clientId") || "";
  }

  validate(payload: KeycloakUser): AuthenticatedUser {
    // Extract realm roles
    const realmRoles: string[] = payload.realm_access?.roles || [];

    // Extract client-specific roles
    const clientRoles: string[] =
      payload.resource_access?.[this.clientId]?.roles || [];

    // Combine all roles
    const allRoles: string[] = [...realmRoles, ...clientRoles];

    return {
      userId: payload.sub,
      username: payload.preferred_username || payload.email || payload.sub,
      email: payload.email,
      roles: allRoles,
      realmRoles,
      clientRoles,
    };
  }
}
