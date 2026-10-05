import * as Joi from "joi";
import { keycloakEnvSchema } from "@app/common";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3004),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  MATCHES_DB_HOST: Joi.string().default("localhost"),
  MATCHES_DB_PORT: Joi.number().default(5436),
  MATCHES_DB_USER: Joi.string().default("hmeet_matches"),
  MATCHES_DB_PASSWORD: Joi.string().default("hmeet_matches_password"),
  MATCHES_DB_NAME: Joi.string().default("hmeet_matches"),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("matches-service"),
  ...keycloakEnvSchema,
});
