import { Injectable, Logger } from "@nestjs/common";
import { MinioService } from "../minio/minio.service";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { KAFKA_TOPICS, ImageDeletedEvent } from "@app/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Image } from "./image.entity";
import { v4 as uuidv4 } from "uuid";

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
    @InjectRepository(Image)
    private readonly imagesRepo: Repository<Image>,

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
    const id = uuidv4();
    const { objectName, url } = await this.minio.upload(
      buffer,
      originalName,
      id,
      mimetype,
      context,
    );

    const image = this.imagesRepo.create({
      id,
      imageName: objectName,
      originalName,
      imageType: mimetype,
      imageSize: buffer.length,
      imageUrl: url,
    });

    try {
      await this.imagesRepo.save(image);
    } catch (error) {
      // If DB save fails, delete the file from MinIO so we don't have orphaned files
      this.logger.error(
        `DB save failed for ${objectName}, cleaning up MinIO...`,
      );
      await this.minio.delete(objectName);
      throw error; // Re-throw the error so the controller knows the upload failed
    }

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

    // Add this line to remove the record from your database as well
    await this.imagesRepo.delete({ imageName: objectName });

    const event: ImageDeletedEvent = { objectName, ownerId };
    await this.kafkaProducer.emit(KAFKA_TOPICS.IMAGE_DELETED, event);
    this.logger.log(`Image deleted: ${objectName} by owner ${ownerId}`);
  }
}
