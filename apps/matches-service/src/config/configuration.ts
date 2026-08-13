export default () => ({
  port: parseInt(process.env.PORT || "3004", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    host: process.env.MATCHES_DB_HOST || "hmeet_matches_db",
    port: parseInt(process.env.MATCHES_DB_PORT || "5432", 10),
    username: process.env.MATCHES_DB_USER || "hmeet_matches",
    password: process.env.MATCHES_DB_PASSWORD || "hmeet_matches_password",
    name: process.env.MATCHES_DB_NAME || "hmeet_matches",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "matches-service",
  },
  uploads: {
    dest: process.env.UPLOAD_DEST || "./uploads",
  },
});
