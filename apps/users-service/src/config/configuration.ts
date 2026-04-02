export default () => ({
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    host: process.env.USERS_DB_HOST || "localhost",
    port: parseInt(process.env.USERS_DB_PORT || "5433", 10),
    username: process.env.USERS_DB_USER || "hmeet_users",
    password: process.env.USERS_DB_PASSWORD || "hmeet_users_password",
    name: process.env.USERS_DB_NAME || "hmeet_users",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "users-service",
  },
  uploads: {
    dest: process.env.UPLOAD_DEST || "./uploads",
  },
});
