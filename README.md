# HMeet Backend

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository for HMeet Backend with Keycloak authentication.

## Features

- ✅ **Keycloak Authentication** - JWT-based authentication with role-based access control
- ✅ **Docker Compose** - Local development environment with Keycloak and PostgreSQL
- ✅ **TypeScript** - Full TypeScript support with strict type checking
- ✅ **Environment Configuration** - Joi validation for environment variables
- ✅ **CORS** - Configurable CORS support
- ✅ **Validation** - Global validation pipe with class-validator
- ✅ **Role-Based Guards** - Protect routes with role requirements

## Prerequisites

- Node.js v22.x (see `.nvmrc`)
- Docker and Docker Compose
- npm or yarn

## Project setup

```bash
$ npm install
```

## Keycloak Setup

1. **Start Keycloak with Docker Compose:**

```bash
$ docker-compose up -d
```

2. **Configure Keycloak:**

Follow the detailed setup guide in [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) to:
- Create a realm
- Configure a client
- Create roles and users
- Get your client secret

3. **Update Environment Variables:**

Copy the client secret from Keycloak and update `.env.development`:

```env
KEYCLOAK_CLIENT_SECRET=your-actual-client-secret
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

The API will be available at: `http://localhost:3000/api`

## API Endpoints

### Public Endpoints (No Authentication Required)

- `GET /api` - Hello World
- `GET /api/health` - Health check

### Protected Endpoints (Requires Authentication)

- `GET /api/profile` - Get current user profile

### Role-Based Endpoints

- `GET /api/admin` - Requires `admin` role
- `GET /api/user-or-moderator` - Requires `user` OR `moderator` role

### Authentication

Include the JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

## Environment Variables

Required environment variables (see `.env.development` for example):

- `PORT` - Application port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `KEYCLOAK_AUTH_SERVER_URL` - Keycloak server URL
- `KEYCLOAK_REALM` - Keycloak realm name
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID
- `KEYCLOAK_CLIENT_SECRET` - Keycloak client secret
- `JWT_ISSUER` - JWT issuer URL
- `JWT_AUDIENCE` - JWT audience
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated)

## Project Structure

```
src/
├── auth/                    # Authentication module
│   ├── decorators/         # Custom decorators (@Public, @Roles, @CurrentUser)
│   ├── guards/             # Auth guards (JWT, Roles)
│   ├── interfaces/         # TypeScript interfaces
│   └── strategies/         # Passport strategies (JWT)
├── config/                  # Configuration files
│   ├── configuration.ts    # Environment configuration
│   └── validation.schema.ts # Joi validation schema
├── app.controller.ts       # Example controller with auth
├── app.module.ts           # Root module
├── app.service.ts          # App service
└── main.ts                 # Application entry point
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
