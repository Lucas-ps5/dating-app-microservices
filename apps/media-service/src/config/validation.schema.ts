import * as Joi from "joi";
import { keycloakEnvSchema } from "@app/common";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3003),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  API_GATEWAY_PUBLIC_URL: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .default("http://localhost:3000"),
  OBJECT_STORAGE_ENDPOINT: Joi.string().default("localhost"),
  OBJECT_STORAGE_PORT: Joi.number().default(9000),
  OBJECT_STORAGE_ACCESS_KEY: Joi.string().default("minioadmin"),
  OBJECT_STORAGE_SECRET_KEY: Joi.string().default("minioadmin"),
  OBJECT_STORAGE_BUCKET: Joi.string().default("hmeet-media"),
  OBJECT_STORAGE_USE_SSL: Joi.boolean().default(false),
  OBJECT_STORAGE_PUBLIC_URL: Joi.string().default("http://localhost:9000"),
  OBJECT_STORAGE_PUBLIC_READ: Joi.boolean().default(false),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("media-service"),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().default(10),
  DB_HOST: Joi.string().default("localhost"),
  DB_PORT: Joi.number().default(5435),
  DB_USER: Joi.string().default("hmeet_media"),
  DB_PASSWORD: Joi.string().default("hmeet_media_password"),
  DB_NAME: Joi.string().default("hmeet_media"),
  ...keycloakEnvSchema,
});
