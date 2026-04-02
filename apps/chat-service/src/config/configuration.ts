export default () => ({
  port: parseInt(process.env.PORT || "3002", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    host: process.env.CHAT_DB_HOST || "localhost",
    port: parseInt(process.env.CHAT_DB_PORT || "5434", 10),
    username: process.env.CHAT_DB_USER || "hmeet_chat",
    password: process.env.CHAT_DB_PASSWORD || "hmeet_chat_password",
    name: process.env.CHAT_DB_NAME || "hmeet_chat",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "chat-service",
  },
});
