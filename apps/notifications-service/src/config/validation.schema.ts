import * as Joi from "joi";
import { keycloakEnvSchema } from "@app/common";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3005),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  NOTIFICATIONS_DB_HOST: Joi.string().default("localhost"),
  NOTIFICATIONS_DB_PORT: Joi.number().default(5437),
  NOTIFICATIONS_DB_USER: Joi.string().default("hmeet_notifications"),
  NOTIFICATIONS_DB_PASSWORD: Joi.string().default(
    "hmeet_notifications_password",
  ),
  NOTIFICATIONS_DB_NAME: Joi.string().default("hmeet_notifications"),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("notifications-service"),
  ...keycloakEnvSchema,
});
