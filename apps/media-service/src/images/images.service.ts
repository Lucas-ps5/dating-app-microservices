import { Injectable, Logger } from "@nestjs/common";
import { MinioService } from "../minio/minio.service";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import {
  KAFKA_TOPICS,
  ImageUploadedEvent,
  ImageDeletedEvent,
} from "@app/common";

export interface UploadResult {
  objectName: string;
  url: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly minio: MinioService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    ownerId: string,
    context = "general",
  ): Promise<UploadResult> {
    const { objectName, url } = await this.minio.upload(
      buffer,
      originalName,
      mimetype,
      context,
    );

    const event: ImageUploadedEvent = {
      objectName,
      ownerId,
      context,
      url,
      size: buffer.length,
      mimetype,
      uploadedAt: new Date().toISOString(),
    };

    await this.kafkaProducer.emit(KAFKA_TOPICS.IMAGE_UPLOADED, event);
    this.logger.log(`Image uploaded: ${objectName} by owner ${ownerId}`);

    return { objectName, url, size: buffer.length, mimetype };
  }

  async getPresignedUrl(
    objectName: string,
    expiresSeconds = 3600,
  ): Promise<string> {
    return this.minio.presignedUrl(objectName, expiresSeconds);
  }

  async deleteImage(objectName: string, ownerId: string): Promise<void> {
    await this.minio.delete(objectName);

    const event: ImageDeletedEvent = { objectName, ownerId };
    await this.kafkaProducer.emit(KAFKA_TOPICS.IMAGE_DELETED, event);
    this.logger.log(`Image deleted: ${objectName} by owner ${ownerId}`);
  }
}
