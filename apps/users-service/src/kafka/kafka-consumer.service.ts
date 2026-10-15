import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Consumer, EachMessagePayload, Kafka } from "kafkajs";
import { errorMessage, ImageUploadedEvent, KAFKA_TOPICS } from "@app/common";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;
  private connected = false;
  private connecting = false;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {
    const brokers = this.configService.get<string[]>("kafka.brokers") ?? [
      "localhost:29092",
    ];
    const groupId =
      this.configService.get<string>("kafka.groupId") ?? "users-service";
    const kafka = new Kafka({ clientId: "users-service-consumer", brokers });
    this.consumer = kafka.consumer({ groupId });
  }

  async onModuleInit(): Promise<void> {
    this.retryTimer = setInterval(() => void this.connect(), 5_000);
    this.retryTimer.unref();
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (!this.connected) return;
    await this.consumer.disconnect();
  }

  private async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [KAFKA_TOPICS.IMAGE_UPLOADED],
        fromBeginning: true,
      });
      await this.consumer.run({
        eachMessage: async (payload) => this.handleMessage(payload),
      });
      this.connected = true;
      this.logger.log(
        "Kafka consumer connected and listening for image uploads",
      );
    } catch (error) {
      this.logger.warn(
        `Kafka consumer unavailable: ${errorMessage(error)}; will retry`,
      );
      try {
        await this.consumer.disconnect();
      } catch {
        // The consumer may not have connected.
      }
    } finally {
      this.connecting = false;
    }
  }

  private async handleMessage({ topic, message }: EachMessagePayload) {
    if (topic !== KAFKA_TOPICS.IMAGE_UPLOADED) return;
    const value = message.value?.toString();
    if (!value) return;

    let event: ImageUploadedEvent;
    try {
      event = JSON.parse(value) as ImageUploadedEvent;
    } catch {
      this.logger.warn("Ignoring malformed image.uploaded payload");
      return;
    }

    await this.handleImageUploaded(event);
  }

  async handleImageUploaded(event: ImageUploadedEvent): Promise<void> {
    if (event?.context !== "avatar") return;
    if (!event.ownerId || !event.url || !event.objectName) {
      this.logger.warn(`Ignoring malformed image.uploaded event`);
      return;
    }

    const user = await this.usersRepo.findOne({
      where: { id: event.ownerId },
    });
    if (!user) {
      throw new Error(`Cannot attach image to missing user ${event.ownerId}`);
    }

    const photos = user.photos ?? [];
    if (photos.includes(event.url)) return;

    user.photos = [...photos, event.url];
    await this.usersRepo.save(user);
  }
}
