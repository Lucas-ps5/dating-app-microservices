import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

/**
 * Verifies Keycloak access tokens and exposes the guards every service uses.
 *
 * Import once per application module:
 *   imports: [AuthModule.forRoot()]
 *
 * The strategy reads `keycloak.*` / `jwt.*` from the app's own ConfigModule
 * and falls back to the matching environment variables, so each service only
 * needs to declare the Keycloak settings it cares about.
 */
@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" }), ConfigModule],
  providers: [
    {
      provide: JwtStrategy,
      useFactory: (configService: ConfigService) =>
        new JwtStrategy(configService),
      inject: [ConfigService],
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PassportModule, JwtStrategy, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
