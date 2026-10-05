import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { Message, MessageStatus, MessageType } from "./message.entity";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { CountResponse, KAFKA_TOPICS, MessageSentEvent } from "@app/common";
import { Conversation } from "./conversation.entity";
import { MatchesService } from "../matches/matches.service";

const MAX_SEND_ATTEMPTS = 3;

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

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly matchesService: MatchesService,
  ) {}

  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
    attempt = 1,
  ): Promise<Message> {
    if (senderId === receiverId) {
      throw new BadRequestException("You cannot message yourself");
    }

    if (!(await this.matchesService.areMatched(senderId, receiverId))) {
      throw new ForbiddenException(
        "You can only message users you have matched with",
      );
    }
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

      // Handle the race condition where a concurrent request created the
      // conversation first. Bounded retry instead of unbounded recursion.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === "23505"
      ) {
        if (attempt >= MAX_SEND_ATTEMPTS) {
          this.logger.error(
            `Failed to create conversation for ${user1Id}/${user2Id} after ${attempt} attempts`,
          );
          throw error;
        }
        return this.sendMessage(
          senderId,
          receiverId,
          content,
          type,
          attempt + 1,
        );
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
    userId: string,
  ): Promise<ConversationData> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    this.assertParticipant(conversation, userId);

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

  private assertParticipant(
    conversation: Pick<Conversation, "user1Id" | "user2Id">,
    userId: string,
  ): void {
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException(
        "You are not a participant of this conversation",
      );
    }
  }

  async readMessages(userId: string, conversationId: string): Promise<void> {
    // 1. Verify the caller actually belongs to the conversation
    const existing = await this.conversationRepo.findOne({
      where: { id: conversationId },
      select: ["id", "user1Id", "user2Id"],
    });

    if (!existing) {
      throw new NotFoundException("Conversation not found");
    }

    this.assertParticipant(existing, userId);

    // 2. Bulk update unread messages to READ
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
