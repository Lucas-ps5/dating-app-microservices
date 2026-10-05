/**
 * `ConfigModule` resolves its env file from `.env.${process.env.NODE_ENV}`, and
 * Jest forces `NODE_ENV=test`, for which no env file exists — so booting the
 * real `AppModule` fails Joi validation before a single test runs.
 *
 * Seeding the required keys keeps the suite hermetic and independent of local
 * `.env` files. None of these values are contacted: the specs only issue
 * unauthenticated requests, which `JwtAuthGuard` rejects before the JWT
 * strategy ever talks to Keycloak.
 */
const required: Record<string, string> = {
  KEYCLOAK_AUTH_SERVER_URL: "http://localhost:8080",
  KEYCLOAK_REALM: "hmeet",
  KEYCLOAK_CLIENT_ID: "hmeet-backend",
  JWT_ISSUER: "http://localhost:8080/realms/hmeet",
  JWT_AUDIENCE: "hmeet-backend",
  CORS_ORIGIN: "http://localhost:5173",
};

for (const [key, value] of Object.entries(required)) {
  process.env[key] ??= value;
}
