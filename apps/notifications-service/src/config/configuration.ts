import { keycloakConfiguration } from "@app/common";

export default () => ({
  port: parseInt(process.env.PORT || "3005", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    host: process.env.NOTIFICATIONS_DB_HOST || "localhost",
    port: parseInt(process.env.NOTIFICATIONS_DB_PORT || "5437", 10),
    username:
      process.env.NOTIFICATIONS_DB_USER || "hmeet_notifications",
    password:
      process.env.NOTIFICATIONS_DB_PASSWORD ||
      "hmeet_notifications_password",
    name:
      process.env.NOTIFICATIONS_DB_NAME || "hmeet_notifications",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "notifications-service",
  },
  ...keycloakConfiguration(),
});
