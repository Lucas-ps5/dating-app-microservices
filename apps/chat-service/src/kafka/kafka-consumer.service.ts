import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import {
  errorMessage,
  KAFKA_TOPICS,
  MatchCreatedEvent,
  UserDeletedEvent,
} from "@app/common";
import { MatchesService } from "../matches/matches.service";
import { ConversationsService } from "../messages/conversations.service";

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private connected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly matchesService: MatchesService,
    private readonly conversationsService: ConversationsService,
  ) {
    const brokers = this.configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    const groupId =
      this.configService.get<string>("kafka.groupId") ?? "chat-service";
    this.kafka = new Kafka({ clientId: "chat-service-consumer", brokers });
    this.consumer = this.kafka.consumer({ groupId });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [KAFKA_TOPICS.MATCH_CREATED, KAFKA_TOPICS.USER_DELETED],
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

  async onModuleDestroy() {
    if (!this.connected) return;
    try {
      await this.consumer.disconnect();
    } catch {
      // Already disconnected
    }
  }

  private async handleMessage({ topic, message }: EachMessagePayload) {
    const value = message.value?.toString();
    if (!value) return;

    try {
      const payload: unknown = JSON.parse(value);
      switch (topic) {
        case KAFKA_TOPICS.MATCH_CREATED:
          await this.onMatchCreated(payload as MatchCreatedEvent);
          break;
        case KAFKA_TOPICS.USER_DELETED:
          await this.onUserDeleted(payload as UserDeletedEvent);
          break;
        default:
          this.logger.warn(`No handler for topic: ${topic}`);
      }
    } catch (err) {
      this.logger.error(
        `Error handling message on topic "${topic}": ${errorMessage(err)}`,
      );
    }
  }

  private async onMatchCreated(event: MatchCreatedEvent): Promise<void> {
    const { matchId, user1Id, user2Id } = event;
    if (!matchId || !user1Id || !user2Id) {
      this.logger.warn(
        `Ignoring malformed match.created: ${JSON.stringify(event)}`,
      );
      return;
    }

    await this.matchesService.recordMatchFromEvent(user1Id, user2Id, matchId);
    await this.conversationsService.ensureConversationExists(user1Id, user2Id);

    this.logger.log(`Match ${matchId} projected into chat-service`);
  }

  private async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event?.keycloakId;
    if (!userId) {
      this.logger.warn(
        `Ignoring malformed user.deleted: ${JSON.stringify(event)}`,
      );
      return;
    }

    const affected = await this.matchesService.deactivateMatchesForUser(userId);
    this.logger.log(
      `Deactivated ${affected} matches for deleted user ${userId}`,
    );
  }
}
