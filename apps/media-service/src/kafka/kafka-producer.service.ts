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
  private producer: Producer;
  private connected = false;
  private connecting?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    const kafka = new Kafka({ clientId: "media-service", brokers });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (err) {
      this.logger.warn(
        `Kafka unavailable: ${errorMessage(err)}; queued events will retry`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.producer.disconnect();
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    await this.connect();
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  }

  private async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.connecting) {
      this.connecting = this.producer
        .connect()
        .then(() => {
          this.connected = true;
          this.logger.log("Kafka producer connected");
        })
        .finally(() => {
          this.connecting = undefined;
        });
    }
    await this.connecting;
  }
}
