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
  ImageDeletedEvent,
  KAFKA_TOPICS,
  MatchCreatedEvent,
  UserDeletedEvent,
} from "@app/common";
import { MatchesService } from "../matches/matches.service";
import { ConversationsService } from "../messages/conversations.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Message,
  MessageStatus,
  MessageType,
} from "../messages/message.entity";
import { Conversation } from "../messages/conversation.entity";

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
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
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
        topics: [
          KAFKA_TOPICS.MATCH_CREATED,
          KAFKA_TOPICS.USER_DELETED,
          KAFKA_TOPICS.IMAGE_DELETED,
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
        case KAFKA_TOPICS.IMAGE_DELETED:
          await this.onImageDeleted(payload as ImageDeletedEvent);
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
    //await this.conversationsService.ensureConversationExists(user1Id, user2Id);

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

  async onImageDeleted(event: ImageDeletedEvent): Promise<void> {
    if (!event?.ownerId || !event.objectName) {
      this.logger.warn(
        `Ignoring malformed image.deleted: ${JSON.stringify(event)}`,
      );
      return;
    }

    const encodedObjectName = event.objectName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const candidates = [...new Set([event.objectName, encodedObjectName])];

    const messages = await this.messageRepo.find({
      where: {
        senderId: event.ownerId,
        type: MessageType.IMAGE,
      },
    });
    const matchingMessages = messages.filter((message) =>
      candidates.some((candidate) =>
        this.messageMatchesObjectName(message.content, candidate),
      ),
    );
    const matchingIds = matchingMessages.map((message) => message.id);

    if (!matchingIds.length) return;

    await this.messageRepo.delete(matchingIds);
    await this.refreshDeletedMessageConversations(matchingMessages);
    this.logger.log(
      `Removed ${matchingIds.length} chat image message(s) for deleted object ${event.objectName}`,
    );
  }

  private async refreshDeletedMessageConversations(
    messages: Message[],
  ): Promise<void> {
    const conversationIds = [
      ...new Set(messages.map((message) => message.conversationId)),
    ];

    for (const conversationId of conversationIds) {
      const conversation = await this.conversationRepo.findOne({
        where: { id: conversationId },
      });
      if (!conversation) continue;

      const latest = await this.messageRepo.findOne({
        where: { conversationId },
        order: { sentAt: "DESC" },
      });
      conversation.lastMessagePreview =
        latest?.content.substring(0, 50) ?? null;
      conversation.lastMessageSentAt = latest?.sentAt ?? null;

      const unreadDeleted = messages.filter(
        (message) =>
          message.conversationId === conversationId &&
          message.status === MessageStatus.UNREAD,
      );
      for (const message of unreadDeleted) {
        if (message.receiverId === conversation.user1Id) {
          conversation.unreadCountUser1 = Math.max(
            0,
            (conversation.unreadCountUser1 ?? 0) - 1,
          );
        } else if (message.receiverId === conversation.user2Id) {
          conversation.unreadCountUser2 = Math.max(
            0,
            (conversation.unreadCountUser2 ?? 0) - 1,
          );
        }
      }

      await this.conversationRepo.save(conversation);
    }
  }

  private messageMatchesObjectName(
    content: string,
    objectName: string,
  ): boolean {
    let normalizedContent = content;
    try {
      normalizedContent = decodeURIComponent(content);
    } catch {
      // Keep the original value when it is not valid URI encoding.
    }

    return (
      normalizedContent === objectName ||
      normalizedContent.endsWith(`/${objectName}`) ||
      normalizedContent.includes(`/api/media/images/${objectName}`)
    );
  }
}
