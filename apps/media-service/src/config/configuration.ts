export default () => ({
  port: parseInt(process.env.PORT || "3003", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: process.env.MINIO_BUCKET || "hmeet-media",
    useSSL: process.env.MINIO_USE_SSL === "true",
    publicUrl: process.env.MINIO_PUBLIC_URL || "http://localhost:9000",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
    groupId: process.env.KAFKA_GROUP_ID || "media-service",
  },
  upload: {
    maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || "10", 10),
  },
});
