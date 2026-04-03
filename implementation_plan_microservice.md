# HMeet Backend – Microservices Implementation Plan

The existing repo is a single NestJS app acting as an API Gateway with Keycloak JWT auth already wired up. This plan expands it into a full microservices monorepo matching the target architecture:

```
Frontend (Vue.js)
       │
       ▼
API Gateway (NestJS) ── port 3000
       │  (HTTP proxy to internal services)
       │
       ├──► Users Service (NestJS) ── port 3001
       │         │
       │         └──► Kafka (events)
       │
       └──► Chat Service (NestJS) ── port 3002
                 │
                 └──► Kafka (events)
       │
  Keycloak (Auth) ── port 8080
```

## User Review Required

> [!IMPORTANT]
> **Monorepo conversion**: The entire `src/` will move to `apps/api-gateway/src/`. This is reversible but destructive to the current structure. All imports and [nest-cli.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/nest-cli.json) will be updated accordingly.

> [!IMPORTANT]
> **Two separate Postgres databases** will be added: one for users-service and one for chat-service. Keycloak keeps its existing Postgres. This means 3 Postgres containers in docker-compose.

> [!NOTE]
> **Inter-service communication**: The API Gateway will call Users Service and Chat Service via **HTTP** (internal Docker network). Kafka is used only for **async events** between services (e.g., user updated, message sent). No NestJS TCP microservice transport is used — plain REST + Kafka.

> [!NOTE]
> **File uploads**: The photo upload design (`/users/me/photos`) will store files locally (disk storage via Multer) for now. S3/cloud storage can be swapped in later.

---

## Proposed Changes

### 1. Monorepo Scaffold

#### [MODIFY] [nest-cli.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/nest-cli.json)
- Add `monorepo: true`
- Register `apps/api-gateway`, `apps/users-service`, `apps/chat-service`
- Register `libs/common`

#### [MODIFY] [package.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/package.json)
Add new dependencies:
- `@nestjs/microservices` – Kafka client
- `@nestjs/typeorm` + `typeorm` + `pg` – DB ORM for both services
- `@nestjs/swagger` + `swagger-ui-express` – API docs on gateway
- `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` – Chat WebSocket
- `class-validator` + `class-transformer` – DTO validation
- `kafkajs` – Kafka client
- `multer` + `@types/multer` – file upload
- `uuid` – ID generation

---

### 2. Shared Library `libs/common`

#### [NEW] libs/common/src/index.ts
Barrel export for all shared items.

#### [NEW] libs/common/src/events/
Kafka event type constants and payload interfaces:
- `user.created`, `user.updated`, `user.deleted`
- `match.created`
- `message.sent`

#### [NEW] libs/common/src/dto/
Shared DTOs used across services (e.g., `PaginationDto`).

#### [NEW] libs/common/src/interfaces/
Re-export [AuthenticatedUser](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/src/auth/interfaces/user.interface.ts#19-27), [KeycloakUser](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/src/auth/interfaces/user.interface.ts#1-18) from existing auth interfaces.

---

### 3. Infrastructure – docker-compose

#### [MODIFY] [docker-compose.yml](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/docker-compose.yml)
Add:
- `zookeeper` (confluentinc/cp-zookeeper:7.5.0)
- `kafka` (confluentinc/cp-kafka:7.5.0) — exposed on port `9092` internally, `29092` externally
- `users-db` (postgres:16-alpine) — DB `hmeet_users`, port `5433`
- `chat-db` (postgres:16-alpine) — DB `hmeet_chat`, port `5434`
- Health checks for all containers

---

### 4. API Gateway (`apps/api-gateway`)

Move existing `src/` → `apps/api-gateway/src/`. All existing auth code stays intact.

#### [NEW] `apps/api-gateway/src/users/users.module.ts`
Proxy module using `@nestjs/axios` to forward requests to Users Service.

#### [NEW] `apps/api-gateway/src/users/users.controller.ts`
Routes:
- `POST /api/users/profile` → create profile (body + auth user)
- `GET /api/users/profile` → get own profile
- `GET /api/users/:id` → get profile by ID
- `PATCH /api/users/profile` → update own profile
- `POST /api/users/me/photos` → upload photo (multipart)
- `GET /api/users/discover` → get match candidates

#### [NEW] `apps/api-gateway/src/chat/chat.module.ts`
Proxy module using `@nestjs/axios` to forward requests to Chat Service.

#### [NEW] `apps/api-gateway/src/chat/chat.controller.ts`
Routes:
- `GET /api/chat/conversations` → list conversations
- `GET /api/chat/conversations/:matchId/messages` → get messages
- `POST /api/chat/matches/:userId` → create match (triggers Kafka event)

#### [MODIFY] `apps/api-gateway/src/app.module.ts`
Import `UsersProxyModule`, `ChatProxyModule`.

#### [MODIFY] `apps/api-gateway/src/main.ts`
Add `SwaggerModule.setup('api/docs', ...)`.

---

### 5. Users Service (`apps/users-service`)

#### [NEW] `apps/users-service/src/main.ts`
Bootstrap NestJS app on port 3001. Also register as Kafka consumer group `users-service`.

#### [NEW] `apps/users-service/src/app.module.ts`
Import `TypeOrmModule`, `UsersModule`, `KafkaModule`.

#### [NEW] `apps/users-service/src/users/user.entity.ts`
TypeORM entity:
```ts
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) keycloakId: string;
  @Column({ unique: true }) email: string;
  @Column({ nullable: true }) name: string;
  @Column({ nullable: true }) bio: string;
  @Column({ type: 'date', nullable: true }) birthdate: Date;
  @Column({ nullable: true }) gender: string;
  @Column({ type: 'decimal', nullable: true }) latitude: number;
  @Column({ type: 'decimal', nullable: true }) longitude: number;
  @Column('text', { array: true, default: [] }) photos: string[];
  @Column({ type: 'jsonb', nullable: true }) preferences: object;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

#### [NEW] `apps/users-service/src/users/users.service.ts`
- `createProfile(dto, keycloakId)` – upsert on keycloakId
- `findByKeycloakId(id)` – get own profile
- `findById(id)` – by internal UUID
- `updateProfile(id, dto)` – partial update
- `addPhoto(id, filename)` – push photo path
- `discover(currentUserId, filters)` – query with gender/age/location filters

#### [NEW] `apps/users-service/src/users/users.controller.ts`
REST endpoints mirroring Gateway routes (Gateway forwards here).

#### [NEW] `apps/users-service/src/users/users.module.ts`

#### [NEW] `apps/users-service/src/kafka/kafka-events.consumer.ts`
Consumes `user.created` from Gateway (if Gateway emits one after Keycloak registration flow).

#### [NEW] `apps/users-service/src/kafka/kafka-events.producer.ts`
Emits `user.updated`, `user.deleted`.

---

### 6. Chat Service (`apps/chat-service`)

#### [NEW] `apps/chat-service/src/main.ts`
Bootstrap NestJS app on port 3002. Register Kafka consumer group `chat-service`.

#### [NEW] `apps/chat-service/src/app.module.ts`
Import `TypeOrmModule`, `MatchesModule`, `MessagesModule`, `KafkaModule`.

#### [NEW] Entities
- **Match** (`match.entity.ts`): [id](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/src/auth/strategies/jwt.strategy.ts#30-52), `user1Id`, `user2Id`, `matchedAt`, `isActive`
- **Message** (`message.entity.ts`): [id](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/src/auth/strategies/jwt.strategy.ts#30-52), `matchId`, `senderId`, `content`, `type` (text/image), `sentAt`, `readAt`
- **Conversation** (view/aggregated from Match + last Message)

#### [NEW] `apps/chat-service/src/matches/matches.service.ts`
- `createMatch(user1Id, user2Id)` – mutual match creation
- `listConversations(userId)` – join matches + last message

#### [NEW] `apps/chat-service/src/messages/messages.service.ts`
- `getMessages(matchId, pagination)` – paginated history
- `sendMessage(matchId, senderId, content)` – save + emit Kafka + broadcast via WS

#### [NEW] `apps/chat-service/src/gateways/chat.gateway.ts`
Socket.IO gateway:
- `handleConnection` – verify JWT, join room `match:{matchId}`
- `handleDisconnect`
- `message` event – calls `messagesService.sendMessage`, broadcasts to room

#### [NEW] Kafka consumer
Listens to `user.updated` and `user.deleted` to sync denormalized sender names in messages.

#### [NEW] Kafka producer
Emits `match.created`, `message.sent`.

---

## Verification Plan

### Automated Tests

**Existing tests** (keep passing):
```bash
# Unit tests
npm test

# E2E tests (requires env vars)
npm run test:e2e
```

**New unit tests to write**:
- `apps/users-service/src/users/users.service.spec.ts` – mock TypeORM repo, test CRUD
- `apps/chat-service/src/matches/matches.service.spec.ts` – test match creation/dedup
- `apps/chat-service/src/messages/messages.service.spec.ts` – test message persistence

Run per-app:
```bash
npm run test -- --testPathPattern=users-service
npm run test -- --testPathPattern=chat-service
```

### Manual Verification

1. **Start all infrastructure:**
   ```bash
   docker-compose up -d
   # Wait ~60s for Keycloak to be healthy
   ```

2. **Start all apps in separate terminals:**
   ```bash
   npm run start:dev api-gateway      # http://localhost:3000
   npm run start:dev users-service    # http://localhost:3001
   npm run start:dev chat-service     # http://localhost:3002
   ```

3. **Health checks** (no auth needed):
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3001/api/health
   curl http://localhost:3002/api/health
   # All should return { status: "ok" }
   ```

4. **Swagger UI**: Open `http://localhost:3000/api/docs` in browser — all routes should be documented.

5. **Obtain a Keycloak token** (follow [KEYCLOAK_SETUP.md](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/KEYCLOAK_SETUP.md)) and test a protected route:
   ```bash
   TOKEN="<your-keycloak-access-token>"
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/profile
   ```

6. **WebSocket**: Connect to `ws://localhost:3002` with Socket.IO client, join a match room, verify real-time messaging.
