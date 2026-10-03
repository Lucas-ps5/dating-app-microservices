import * as Joi from "joi";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  MATCHES_DB_HOST: Joi.string().default("localhost"),
  MATCHES_DB_PORT: Joi.number().default(5433),
  MATCHES_DB_USER: Joi.string().default("hmeet_matches"),
  MATCHES_DB_PASSWORD: Joi.string().default("hmeet_matches_password"),
  MATCHES_DB_NAME: Joi.string().default("hmeet_matches"),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("matches-service"),
  UPLOAD_DEST: Joi.string().default("./uploads"),
  // Keycloak Admin
  KEYCLOAK_URL: Joi.string().uri().default("http://localhost:8080"),
  KEYCLOAK_REALM: Joi.string().default("hmeet"),
  KEYCLOAK_ADMIN_REALM: Joi.string().default("master"),
  KEYCLOAK_ADMIN_USERNAME: Joi.string().default("admin"),
  KEYCLOAK_ADMIN_PASSWORD: Joi.string().default("admin"),
  KEYCLOAK_ADMIN_CLIENT_ID: Joi.string().default("admin-cli"),
});
