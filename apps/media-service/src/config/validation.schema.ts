import * as Joi from "joi";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3003),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  MINIO_ENDPOINT: Joi.string().default("localhost"),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().default("minioadmin"),
  MINIO_SECRET_KEY: Joi.string().default("minioadmin"),
  MINIO_BUCKET: Joi.string().default("hmeet-media"),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_PUBLIC_URL: Joi.string().default("http://localhost:9000"),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("media-service"),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().default(10),
  DB_HOST: Joi.string().default("localhost"),
  DB_PORT: Joi.number().default(5435),
  DB_USER: Joi.string().default("hmeet_media"),
  DB_PASSWORD: Joi.string().default("hmeet_media_password"),
  DB_NAME: Joi.string().default("hmeet_media"),
});
