import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>('kafka.brokers') ?? ['localhost:29092'];
    const groupId = this.configService.get<string>('kafka.groupId') ?? 'chat-service';
    this.kafka = new Kafka({ clientId: 'chat-service-consumer', brokers });
    this.consumer = this.kafka.consumer({ groupId });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [KAFKA_TOPICS.USER_UPDATED, KAFKA_TOPICS.USER_DELETED],
        fromBeginning: false,
      });
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
      this.logger.log('Kafka consumer connected and listening');
    } catch (err) {
      this.logger.warn(`Kafka consumer failed to connect: ${err.message}. Continuing without Kafka.`);
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handleMessage({ topic, message }: EachMessagePayload) {
    const value = message.value?.toString();
    if (!value) return;

    try {
      const payload = JSON.parse(value);
      switch (topic) {
        case KAFKA_TOPICS.USER_UPDATED:
          // Future: update denormalised sender name cache
          this.logger.log(`user.updated received: ${JSON.stringify(payload)}`);
          break;
        case KAFKA_TOPICS.USER_DELETED:
          // Future: deactivate matches for deleted user
          this.logger.log(`user.deleted received: ${JSON.stringify(payload)}`);
          break;
        default:
          this.logger.warn(`No handler for topic: ${topic}`);
      }
    } catch (err) {
      this.logger.error(`Error handling message on topic "${topic}": ${err.message}`);
    }
  }
}
