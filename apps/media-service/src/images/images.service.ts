import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { MinioService } from "../minio/minio.service";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { KAFKA_TOPICS, ImageDeletedEvent } from "@app/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Image } from "./image.entity";
import { v4 as uuidv4 } from "uuid";
import type { Readable } from "stream";

export interface UploadResult {
  objectName: string;
  url: string;
  size: number;
  mimetype: string;
}

const ADMIN_ROLE = "admin";

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
      ownerId,
      context,
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

  /**
   * Loads an object row and asserts the caller owns it. Without this check any
   * authenticated user could presign or delete any object in the bucket by
   * guessing its name.
   */
  private async findOwned(
    objectName: string,
    requesterId: string,
    requesterRoles: string[] = [],
  ): Promise<Image> {
    const image = await this.imagesRepo.findOne({
      where: { imageName: objectName },
    });

    if (!image) {
      throw new NotFoundException(`Image ${objectName} not found`);
    }

    if (image.ownerId !== requesterId && !requesterRoles.includes(ADMIN_ROLE)) {
      throw new ForbiddenException("You do not own this image");
    }

    return image;
  }

  async getPresignedUrl(
    objectName: string,
    requesterId: string,
    requesterRoles: string[] = [],
    expiresSeconds = 3600,
  ): Promise<string> {
    await this.findOwned(objectName, requesterId, requesterRoles);
    return this.minio.presignedUrl(objectName, expiresSeconds);
  }

  /**
   * Resolves an object to a readable stream plus the metadata needed for HTTP
   * response headers. Ownership is checked first, so this cannot be used to
   * read another user's image. The stream is lazy: the MinIO request only
   * starts once the caller consumes it.
   */
  async getImageStream(
    objectName: string,
    requesterId: string,
    requesterRoles: string[] = [],
  ): Promise<{
    stream: Readable;
    contentType: string;
    size: number;
    fileName: string;
  }> {
    const image = await this.findOwned(objectName, requesterId, requesterRoles);
    const size = await this.minio.objectSize(objectName);
    const stream = await this.minio.getObjectStream(objectName);

    return {
      stream,
      // Fall back to the stored type; never sniff from the body.
      contentType: image.imageType || "application/octet-stream",
      size,
      fileName: image.originalName,
    };
  }

  async deleteImage(
    objectName: string,
    ownerId: string,
    requesterRoles: string[] = [],
  ): Promise<void> {
    await this.findOwned(objectName, ownerId, requesterRoles);

    await this.minio.delete(objectName);

    await this.imagesRepo.delete({ imageName: objectName });

    const event: ImageDeletedEvent = { objectName, ownerId };
    await this.kafkaProducer.emit(KAFKA_TOPICS.IMAGE_DELETED, event);
    this.logger.log(`Image deleted: ${objectName} by owner ${ownerId}`);
  }
}
