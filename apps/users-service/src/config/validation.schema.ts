import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  USERS_DB_HOST: Joi.string().default('localhost'),
  USERS_DB_PORT: Joi.number().default(5433),
  USERS_DB_USER: Joi.string().default('hmeet_users'),
  USERS_DB_PASSWORD: Joi.string().default('hmeet_users_password'),
  USERS_DB_NAME: Joi.string().default('hmeet_users'),
  KAFKA_BROKERS: Joi.string().default('localhost:29092'),
  KAFKA_GROUP_ID: Joi.string().default('users-service'),
  UPLOAD_DEST: Joi.string().default('./uploads'),
});
