import { keycloakConfiguration } from "@app/common";

export default () => ({
  port: parseInt(process.env.PORT || "3003", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  apiGatewayPublicUrl:
    process.env.API_GATEWAY_PUBLIC_URL || "http://localhost:3000",
  objectStorage: {
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || "localhost",
    port: parseInt(process.env.OBJECT_STORAGE_PORT || "9000", 10),
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY || "minioadmin",
    secretKey: process.env.OBJECT_STORAGE_SECRET_KEY || "minioadmin",
    bucket: process.env.OBJECT_STORAGE_BUCKET || "hmeet-media",
    useSSL: process.env.OBJECT_STORAGE_USE_SSL === "true",
    publicUrl:
      process.env.OBJECT_STORAGE_PUBLIC_URL || "http://localhost:9000",
    publicRead:
      process.env.OBJECT_STORAGE_PUBLIC_READ === "true" ||
      (process.env.OBJECT_STORAGE_PUBLIC_READ !== "false" &&
        process.env.NODE_ENV !== "production"),
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "media-service",
  },
  upload: {
    maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || "10", 10),
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5435", 10),
    username: process.env.DB_USER || "hmeet_media",
    password: process.env.DB_PASSWORD || "hmeet_media_password",
    name: process.env.DB_NAME || "hmeet_media",
  },
  ...keycloakConfiguration(),
});
