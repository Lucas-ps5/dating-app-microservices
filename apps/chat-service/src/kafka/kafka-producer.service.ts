import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer } from "kafkajs";
import { errorMessage } from "@app/common";

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    this.kafka = new Kafka({ clientId: "chat-service", brokers });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log("Kafka producer connected");
    } catch (err) {
      this.logger.warn(
        `Kafka producer failed to connect: ${errorMessage(err)}. Continuing without Kafka.`,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.connected) return;
    try {
      await this.producer.disconnect();
    } catch {
      // Already disconnected
    }
  }

  async emit<T>(topic: string, payload: T): Promise<void> {
    if (!this.connected) {
      this.logger.warn(`Skipping emit to "${topic}": producer not connected`);
      return;
    }

    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit to topic "${topic}": ${errorMessage(err)}`,
      );
    }
  }
}
