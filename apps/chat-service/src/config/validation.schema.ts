import * as Joi from "joi";

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3002),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  CHAT_DB_HOST: Joi.string().default("localhost"),
  CHAT_DB_PORT: Joi.number().default(5434),
  CHAT_DB_USER: Joi.string().default("hmeet_chat"),
  CHAT_DB_PASSWORD: Joi.string().default("hmeet_chat_password"),
  CHAT_DB_NAME: Joi.string().default("hmeet_chat"),
  KAFKA_BROKERS: Joi.string().default("localhost:29092"),
  KAFKA_GROUP_ID: Joi.string().default("chat-service"),
});
