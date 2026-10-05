import * as Joi from "joi";

/**
 * Environment variables every service needs in order to verify Keycloak
 * access tokens. Spread into each app's Joi validation schema:
 *
 *   export const validationSchema = Joi.object({
 *     ...keycloakEnvSchema,
 *     CHAT_DB_HOST: Joi.string().required(),
 *   });
 */
export const keycloakEnvSchema = {
  KEYCLOAK_AUTH_SERVER_URL: Joi.string().uri().default("http://localhost:8080"),
  KEYCLOAK_REALM: Joi.string().default("hmeet"),
  KEYCLOAK_CLIENT_ID: Joi.string().default("hmeet-backend"),
  JWT_ISSUER: Joi.string().uri().default("http://localhost:8080/realms/hmeet"),
  JWT_AUDIENCE: Joi.string().default("hmeet-backend"),
};

/**
 * Maps the validated env vars onto the nested shape `JwtStrategy` reads
 * (`keycloak.*` and `jwt.*`).
 */
export const keycloakConfiguration = () => ({
  keycloak: {
    authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
    realm: process.env.KEYCLOAK_REALM,
    clientId: process.env.KEYCLOAK_CLIENT_ID,
  },
  jwt: {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  },
});
