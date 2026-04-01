import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from './message.entity';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { KAFKA_TOPICS } from '@app/common';

export interface SendMessageDto {
  matchId: string;
  senderId: string;
  content: string;
  type?: MessageType;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepo: Repository<Message>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async sendMessage(dto: SendMessageDto): Promise<Message> {
    const message = this.messagesRepo.create({
      matchId: dto.matchId,
      senderId: dto.senderId,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
    });
    const saved = await this.messagesRepo.save(message);

    await this.kafkaProducer.emit(KAFKA_TOPICS.MESSAGE_SENT, {
      messageId: saved.id,
      matchId: saved.matchId,
      senderId: saved.senderId,
      content: saved.content,
      type: saved.type,
      sentAt: saved.sentAt.toISOString(),
    });

    this.logger.debug(`Message ${saved.id} saved for match ${dto.matchId}`);
    return saved;
  }

  async getMessages(
    matchId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedMessages> {
    const [data, total] = await this.messagesRepo.findAndCount({
      where: { matchId },
      order: { sentAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: data.reverse(), total, page, limit };
  }

  async markAsRead(matchId: string, userId: string): Promise<void> {
    await this.messagesRepo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: new Date() })
      .where('matchId = :matchId', { matchId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
  }

  async getLastMessage(matchId: string): Promise<Message | null> {
    return this.messagesRepo.findOne({
      where: { matchId },
      order: { sentAt: 'DESC' },
    });
  }
}
