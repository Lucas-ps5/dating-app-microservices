export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  keycloak: {
    authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL || '',
    realm: process.env.KEYCLOAK_REALM || '',
    clientId: process.env.KEYCLOAK_CLIENT_ID || '',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  },
  jwt: {
    issuer: process.env.JWT_ISSUER || '',
    audience: process.env.JWT_AUDIENCE || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  },
  services: {
    usersUrl: process.env.USERS_SERVICE_URL || 'http://localhost:3001/api',
    chatUrl: process.env.CHAT_SERVICE_URL || 'http://localhost:3002/api',
  },
});
