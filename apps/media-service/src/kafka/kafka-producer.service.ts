import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer } from "kafkajs";

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    const kafka = new Kafka({ clientId: "media-service", brokers });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log("Kafka producer connected");
    } catch (err) {
      this.logger.warn(
        `Kafka unavailable: ${err.message} – events will be skipped`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.producer.disconnect();
  }

  async emit(topic: string, payload: unknown): Promise<void> {
    if (!this.connected) return;
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
    } catch (err) {
      this.logger.error(`Failed to emit "${topic}": ${err.message}`);
    }
  }
}
