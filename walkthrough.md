# HMeet Backend – Microservices Walkthrough

## What Was Built

A complete NestJS monorepo for a dating app backend per the specified architecture.

```
Frontend (Vue.js)
       │
       ▼
API Gateway (NestJS)  ── port 3000  ── Swagger at /api/docs
       │  x-user-id / x-user-email / x-user-roles headers
       ├──HTTP──► Users Service  ── port 3001
       │               │
       │           Postgres (users-db, 5433)
       │
       └──HTTP──► Chat Service  ── port 3002
                       │
                  Postgres (chat-db, 5434)
                       │
                  Socket.IO WebSocket /chat

All services ◄──── Kafka (9092 internal / 29092 external)

Keycloak ──────── port 8080
Kafka UI ──────── port 8090
```

---

## Files Created

### Monorepo Structure
| File | Purpose |
|------|---------|
| [nest-cli.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/nest-cli.json) | Monorepo config: 3 apps + 1 shared lib |
| [tsconfig.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/tsconfig.json) | Root tsconfig (commonjs, `@app/common` path alias) |
| `apps/*/tsconfig.app.json` | Per-app tsconfig |
| [libs/common/tsconfig.lib.json](file:///home/logabo/Desktop/school-work/HMeet/hmeet-backend/libs/common/tsconfig.lib.json) | Shared lib tsconfig |

### `libs/common`
| File | Purpose |
|------|---------|
| `src/index.ts` | Barrel export |
| `src/events/kafka-events.ts` | Kafka topic constants + event payload interfaces |
| `src/dto/pagination.dto.ts` | Shared `PaginationDto` |
| `src/interfaces/authenticated-user.interface.ts` | Shared `AuthenticatedUser` |

### `apps/api-gateway` (moved from `src/`)
| File | Purpose |
|------|---------|
| `src/app.module.ts` | Imports `UsersProxyModule`, `ChatProxyModule` |
| `src/main.ts` | Added Swagger setup |
| `src/config/configuration.ts` | Added `services.usersUrl`, `services.chatUrl` |
| `src/users/users-proxy.module.ts` | HttpModule + proxy DI |
| `src/users/users-proxy.service.ts` | Forwards requests to port 3001, injects x-user-* headers |
| `src/users/users.controller.ts` | `/api/users/**` routes |
| `src/chat/chat-proxy.module.ts` | HttpModule + proxy DI |
| `src/chat/chat-proxy.service.ts` | Forwards requests to port 3002 |
| `src/chat/chat.controller.ts` | `/api/chat/**` routes |

### `apps/users-service`
| File | Purpose |
|------|---------|
| `src/main.ts` | Bootstrap on port 3001 |
| `src/app.module.ts` | TypeORM + KafkaModule + UsersModule |
| `src/users/user.entity.ts` | Full User entity (location, photos[], JSONB preferences) |
| `src/users/dto/user.dto.ts` | Create/Update/Discover DTOs |
| `src/users/users.service.ts` | CRUD, discovery filters, Kafka emission |
| `src/users/users.controller.ts` | REST + Multer photo upload |
| `src/kafka/kafka-producer.service.ts` | KafkaJS producer |
| `src/kafka/kafka-consumer.service.ts` | Subscribes to `user.created` |

### `apps/chat-service`
| File | Purpose |
|------|---------|
| `src/main.ts` | Bootstrap on port 3002 |
| `src/app.module.ts` | TypeORM + KafkaModule + all feature modules |
| `src/matches/match.entity.ts` | Match entity (unique user pair constraint) |
| `src/messages/message.entity.ts` | Message entity (enum type, readAt) |
| `src/matches/matches.service.ts` | Create match (normalised ordering), participant validation |
| `src/messages/messages.service.ts` | Send message, paginated history, mark-as-read, last message |
| `src/matches/matches.controller.ts` | REST: create/list/get matches |
| `src/messages/messages.controller.ts` | REST: list conversations, paginated messages, mark-as-read |
| `src/gateway/chat.gateway.ts` | Socket.IO: join-match rooms, real-time broadcast, typing |
| `src/kafka/kafka-producer.service.ts` | Emits `match.created`, `message.sent` |
| `src/kafka/kafka-consumer.service.ts` | Subscribes to `user.updated`, `user.deleted` |

### Infrastructure
| File | Change |
|------|--------|
| `docker-compose.yml` | Added Zookeeper, Kafka, users-db (5433), chat-db (5434), Kafka UI (8090) |
| `.env.development` | Added `USERS_SERVICE_URL`, `CHAT_SERVICE_URL` |
| `apps/users-service/.env` | DB + Kafka config for port 3001 |
| `apps/chat-service/.env` | DB + Kafka config for port 3002 |
| `package.json` | Added `start:users:dev`, `start:chat:dev`, `build:all` scripts |

---

## Kafka Events Contract

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `user.created` | API Gateway (future) | users-service |
| `user.updated` | users-service | chat-service |
| `user.deleted` | users-service | chat-service |
| `match.created` | chat-service | — |
| `message.sent` | chat-service | — |

---

## Build Verification

All three apps compiled with **zero TypeScript errors**:
```
✅ nest build api-gateway
✅ nest build users-service
✅ nest build chat-service
```

---

## How to Run

```bash
# 1. Start all infrastructure (Keycloak, Kafka, 3× Postgres)
docker-compose up -d

# 2. Start each service (3 separate terminals)
npm run start:dev           # API Gateway → http://localhost:3000/api
npm run start:users:dev     # Users Service → http://localhost:3001/api
npm run start:chat:dev      # Chat Service → http://localhost:3002/api
```

**Swagger UI:** http://localhost:3000/api/docs

**Kafka UI:** http://localhost:8090

**WebSocket (Socket.IO):**
```js
const socket = io('http://localhost:3002/chat', {
  auth: { userId: '<keycloak-user-id>' }
});
socket.emit('join-match', '<matchId>');
socket.emit('message', { matchId: '<matchId>', content: 'Hello!' });
socket.on('new-message', (msg) => console.log(msg));
socket.emit('typing', '<matchId>'); // Triggers typing indicator to other user
```
