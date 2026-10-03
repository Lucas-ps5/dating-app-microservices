import { Injectable, Logger } from "@nestjs/common";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { Message, MessageStatus, MessageType } from "./message.entity";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { CountResponse, KAFKA_TOPICS, MessageSentEvent } from "@app/common";
import { Conversation } from "./conversation.entity";

export interface SendMessageDto {
  matchId: string;
  senderId: string;
  content: string;
  type?: MessageType;
}

export type MessageResponseDto = Omit<Message, "sentAt" | "readAt"> & {
  readAt?: string | null;
  sentAt?: string;
};

export interface PaginatedMessages {
  data: MessageResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ConversationData = Omit<Conversation, "messages"> & {
  messages: MessageResponseDto[];
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private conversationRepo: Repository<Conversation>;
  private messageRepo: Repository<Message>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
  ): Promise<Message> {
    // 1. THE GOLDEN RULE: Sort UUIDs alphabetically
    const sortedIds = [senderId, receiverId].sort();
    const user1Id = sortedIds[0];
    const user2Id = sortedIds[1];

    // 2. START A DATABASE TRANSACTION
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Find or Create Conversation INSIDE the transaction
      let conversation = await queryRunner.manager.findOne(Conversation, {
        where: { user1Id, user2Id },
      });

      if (!conversation) {
        conversation = queryRunner.manager.create(Conversation, {
          user1Id,
          user2Id,
          // unreadCountUser1 and unreadCountUser2 default to 0 via the entity
        });
        conversation = await queryRunner.manager.save(conversation);
      }

      // 4. Create the Message INSIDE the transaction
      const message = queryRunner.manager.create(Message, {
        conversationId: conversation.id,
        senderId,
        receiverId,
        content,
        type,
      });
      await queryRunner.manager.save(message);

      // 5. Update the Conversation's "Inbox Preview" data
      conversation.lastMessagePreview = content.substring(0, 50);
      conversation.lastMessageSentAt = new Date();

      // --- NEW: Increment the unread count for the RECEIVER ---
      if (receiverId === user1Id) {
        conversation.unreadCountUser1 += 1;
      } else {
        conversation.unreadCountUser2 += 1;
      }

      await queryRunner.manager.save(conversation);

      // 6. COMMIT TRANSACTION
      await queryRunner.commitTransaction();

      // 7. EMIT EVENT (Perfect placement: after commit!)
      await this.kafkaProducer.emit<MessageSentEvent>(
        KAFKA_TOPICS.MESSAGE_SENT,
        {
          messageId: message.id,
          conversationId: conversation.id,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          type: message.type,
          sentAt: message.sentAt.toISOString(),
        },
      );

      return message;
    } catch (error) {
      // 8. ROLLBACK TRANSACTION
      await queryRunner.rollbackTransaction();

      // Handle the race condition
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === "23505"
      ) {
        return this.sendMessage(senderId, receiverId, content, type);
      }

      throw error;
    } finally {
      // 9. Release the query runner
      await queryRunner.release();
    }
  }

  async getMyConversations(userId: string) {
    return this.conversationRepo.find({
      where: [{ user1Id: userId }, { user2Id: userId }],
      order: { lastMessageSentAt: "DESC" },
    });
  }

  async getConversationMessages(conversationId: string) {
    return this.messageRepo.find({
      where: { conversationId },
      order: { sentAt: "ASC" },
    });
  }

  async getConversationById(
    conversationId: string,
  ): Promise<ConversationData | null> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      return null;
    }

    const messages = await this.getConversationMessages(conversation.id);

    return {
      ...conversation,
      messages: messages.map((message) => {
        return {
          ...message,
          sentAt: message.sentAt.toISOString(),
          readAt: message.readAt?.toISOString() || null,
        };
      }),
    };
  }

  async readMessages(userId: string, conversationId: string): Promise<void> {
    // 1. Bulk update unread messages to READ
    const updateResult = await this.messageRepo.update(
      {
        conversationId,
        receiverId: userId,
        status: MessageStatus.UNREAD,
      },
      {
        status: MessageStatus.READ,
        readAt: new Date(),
      },
    );

    // 2. THE EARLY RETURN OPTIMIZATION
    // If 0 rows were affected, it means there were no unread messages to begin with.
    // The unread counter is already 0. Stop here and save database resources!
    if (updateResult.affected === 0) {
      return;
    }

    // 3. We actually marked messages as read, so we MUST reset the conversation counter
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
      // Optimization: Only select the columns we need to check/save.
      // Don't fetch lastMessagePreview or dates into memory for no reason.
      select: [
        "id",
        "user1Id",
        "user2Id",
        "unreadCountUser1",
        "unreadCountUser2",
      ],
    });

    // 4. Reset the specific counter for the user who read the messages
    if (conversation) {
      if (conversation.user1Id === userId) {
        conversation.unreadCountUser1 = 0;
      } else if (conversation.user2Id === userId) {
        conversation.unreadCountUser2 = 0;
      }

      await this.conversationRepo.save(conversation);
    }
  }

  async getAllMyUnreadMessagesCount(userId: string): Promise<CountResponse> {
    const count = await this.messageRepo.count({
      where: {
        receiverId: userId,
        status: MessageStatus.UNREAD,
      },
    });

    return { count };
  }
}
