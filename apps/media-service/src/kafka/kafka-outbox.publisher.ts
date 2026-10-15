import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { errorMessage } from "@app/common";
import { MediaOutboxEvent } from "./outbox-event.entity";
import { KafkaProducerService } from "./kafka-producer.service";

@Injectable()
export class KafkaOutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaOutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    @InjectRepository(MediaOutboxEvent)
    private readonly outboxRepo: Repository<MediaOutboxEvent>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.publishPending(), 5_000);
    this.timer.unref();
    void this.publishPending();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async publishPending(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;

    try {
      const pending = await this.outboxRepo.find({
        where: { publishedAt: IsNull() },
        order: { createdAt: "ASC" },
        take: 100,
      });

      for (const event of pending) {
        try {
          await this.kafkaProducer.publish(event.topic, event.payload);
          await this.outboxRepo.update(event.id, { publishedAt: new Date() });
        } catch (error) {
          this.logger.warn(
            `Outbox event ${event.id} remains queued: ${errorMessage(error)}`,
          );
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read media outbox: ${errorMessage(error)}`);
    } finally {
      this.publishing = false;
    }
  }
}