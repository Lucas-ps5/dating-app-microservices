# HMeet Backend – Microservices Implementation

## Phase 1 – Repo structure & shared libs
- [x] Convert repo to NestJS monorepo ([nest-cli.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/nest-cli.json) with `apps/` + `libs/`)
- [x] Create shared `libs/common` library (DTOs, Kafka event contracts, auth interfaces)

## Phase 2 – Infrastructure (docker-compose)
- [x] Add Kafka + Zookeeper services
- [x] Add users-service Postgres DB (`hmeet-users-db`)
- [x] Add chat-service Postgres DB (`hmeet-chat-db`)
- [x] Wire all services into `hmeet-network`

## Phase 3 – API Gateway (existing app refactor)
- [x] Move existing app to `apps/api-gateway`
- [x] Add proxy routes for `/users/**` → Users Service (HTTP)
- [x] Add proxy routes for `/chat/**` → Chat Service (HTTP)
- [x] Keep existing JWT + Keycloak auth; attach user claims to forwarded requests
- [x] Add Swagger / OpenAPI documentation

## Phase 4 – Users Service (`apps/users-service`)
- [x] Bootstrap NestJS microservice app
- [x] Connect to `hmeet-users-db` (TypeORM + Postgres)
- [x] `User` entity (keycloakId, email, name, bio, birthdate, gender, location, photos, preferences, isActive)
- [x] `UserProfile` CRUD (create on first login, update, get by id)
- [x] Profile photo upload endpoint (multipart)
- [x] User discovery / matching filters endpoint
- [x] Kafka consumer: listen for `user.created` events
- [x] Kafka producer: emit `user.updated`, `user.deleted`
- [x] HTTP transport: expose REST internally on port 3001

## Phase 5 – Chat Service (`apps/chat-service`)
- [x] Bootstrap NestJS microservice app
- [x] Connect to `hmeet-chat-db` (TypeORM + Postgres)
- [x] `Match` entity (user1Id, user2Id, matchedAt, isActive)
- [x] `Message` entity (matchId, senderId, content, type, sentAt, readAt)
- [x] `Conversation` entity (matchId, participants, lastMessage)
- [x] REST endpoints: list conversations, get messages for a match
- [x] WebSocket gateway (Socket.IO) for real-time messaging
- [x] Kafka consumer: listen for `user.updated`, `user.deleted`
- [x] Kafka producer: emit `message.sent`, `match.created`
- [x] HTTP transport: expose REST internally on port 3002

## Phase 6 – Verification
- [x] All three apps compile with zero TypeScript errors (`nest build api-gateway`, `nest build users-service`, `nest build chat-service`)
- [ ] Unit tests for Users Service (service layer)
- [ ] Unit tests for Chat Service (service layer)
- [ ] Integration smoke tests via HTTP (gateway → services)
- [ ] Manual: docker-compose up, hit `/api/health`, `/api/users/profile`, `/api/chat/conversations`
