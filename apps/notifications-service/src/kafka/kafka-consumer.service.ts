import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Consumer, EachMessagePayload, Kafka } from "kafkajs";
import {
  errorMessage,
  KAFKA_TOPICS,
  MatchCreatedEvent,
  ProfileVisitedEvent,
  UserDeletedEvent,
} from "@app/common";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    const brokers = configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    const groupId =
      configService.get<string>("kafka.groupId") ?? "notifications-service";
    this.kafka = new Kafka({
      clientId: "notifications-service-consumer",
      brokers,
    });
    this.consumer = this.kafka.consumer({ groupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [
          KAFKA_TOPICS.PROFILE_VISITED,
          KAFKA_TOPICS.MATCH_CREATED,
          KAFKA_TOPICS.USER_DELETED,
        ],
        fromBeginning: false,
      });
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
      this.connected = true;
      this.logger.log("Kafka consumer connected and listening");
    } catch (err) {
      this.logger.warn(
        `Kafka consumer failed to connect: ${errorMessage(err)}. Continuing without Kafka.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.consumer.disconnect();
    } catch {
      // Already disconnected
    }
  }

  private async handleMessage({
    topic,
    message,
  }: EachMessagePayload): Promise<void> {
    const value = message.value?.toString();
    if (!value) return;

    try {
      const payload: unknown = JSON.parse(value);
      if (topic === KAFKA_TOPICS.PROFILE_VISITED) {
        await this.onProfileVisited(payload as ProfileVisitedEvent);
      } else if (topic === KAFKA_TOPICS.MATCH_CREATED) {
        await this.onMatchCreated(payload as MatchCreatedEvent);
      } else if (topic === KAFKA_TOPICS.USER_DELETED) {
        await this.onUserDeleted(payload as UserDeletedEvent);
      } else {
        this.logger.warn(`No handler for topic: ${topic}`);
      }
    } catch (err) {
      this.logger.error(
        `Error handling message on topic "${topic}": ${errorMessage(err)}`,
      );
    }
  }

  private async onProfileVisited(event: ProfileVisitedEvent): Promise<void> {
    if (
      !event?.visitorId ||
      !event?.profileOwnerId ||
      !event?.visitedAt ||
      event.visitorId === event.profileOwnerId
    ) {
      this.logger.warn(
        `Ignoring malformed profile.visited event: ${JSON.stringify(event)}`,
      );
      return;
    }

    await this.notificationsService.createProfileVisit(
      event.profileOwnerId,
      event.visitorId,
      event.visitedAt,
    );
    this.logger.log(
      `Created profile visit notification for user ${event.profileOwnerId}`,
    );
  }

  private async onMatchCreated(event: MatchCreatedEvent): Promise<void> {
    if (
      !event?.matchId ||
      !event?.user1Id ||
      !event?.user2Id ||
      !event?.matchedAt
    ) {
      this.logger.warn(
        `Ignoring malformed match.created: ${JSON.stringify(event)}`,
      );
      return;
    }

    await Promise.all([
      this.notificationsService.createNewMatch(
        event.user1Id,
        event.user2Id,
        event.matchId,
        event.matchedAt,
      ),
      this.notificationsService.createNewMatch(
        event.user2Id,
        event.user1Id,
        event.matchId,
        event.matchedAt,
      ),
    ]);
    this.logger.log(
      `Created match notifications for users ${event.user1Id} and ${event.user2Id}`,
    );
  }

  private async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event?.keycloakId;
    if (!userId) {
      this.logger.warn(
        `Ignoring malformed user.deleted: ${JSON.stringify(event)}`,
      );
      return;
    }
    await this.notificationsService.deleteNotificationsForUser(userId);
  }
}
