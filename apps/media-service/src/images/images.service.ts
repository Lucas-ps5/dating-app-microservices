import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ObjectStorageService } from "../object-storage/object-storage.service";
import {
  ImageDeletedEvent,
  ImageUploadedEvent,
  KAFKA_TOPICS,
} from "@app/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
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
  private readonly apiGatewayPublicUrl: string;

  constructor(
    @InjectRepository(Image)
    private readonly imagesRepo: Repository<Image>,

    private readonly objectStorage: ObjectStorageService,
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.apiGatewayPublicUrl = (
      configService.get<string>("apiGatewayPublicUrl") ??
      "http://localhost:3000"
    ).replace(/\/+$/, "");
  }

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    ownerId: string,
    context = "general",
  ): Promise<UploadResult> {
    const id = uuidv4();
    const { objectName } = await this.objectStorage.upload(
      buffer,
      originalName,
      id,
      mimetype,
      context,
    );
    const encodedObjectName = objectName
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const url = `${this.apiGatewayPublicUrl}/api/media/images/${encodedObjectName}`;

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
      const event: ImageUploadedEvent = { objectName, ownerId, url, context };
      await this.dataSource.transaction(async (manager) => {
        await manager.save(image);
        await this.enqueueEvent(manager, KAFKA_TOPICS.IMAGE_UPLOADED, event);
      });
    } catch (error) {
      // If DB save fails, delete the file so we don't leave an orphaned object.
      this.logger.error(
        `DB save failed for ${objectName}, cleaning up object storage...`,
      );
      await this.objectStorage.delete(objectName);
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
    return this.objectStorage.presignedUrl(objectName, expiresSeconds);
  }

  /** Resolves a public image key to its stream and response metadata. */
  async getImageStream(objectName: string): Promise<{
    stream: Readable;
    contentType: string;
    size: number;
    fileName: string;
  }> {
    const image = await this.imagesRepo.findOne({
      where: { imageName: objectName },
    });
    if (!image) {
      throw new NotFoundException(`Image ${objectName} not found`);
    }
    const size = await this.objectStorage.objectSize(objectName);
    const stream = await this.objectStorage.getObjectStream(objectName);

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

    await this.objectStorage.delete(objectName);

    const event: ImageDeletedEvent = { objectName, ownerId };
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Image, { imageName: objectName });
      await this.enqueueEvent(manager, KAFKA_TOPICS.IMAGE_DELETED, event);
    });
    this.logger.log(`Image deleted: ${objectName} by owner ${ownerId}`);
  }

  private async enqueueEvent(
    manager: EntityManager,
    topic: string,
    payload: object,
  ): Promise<void> {
    await manager.query(
      'INSERT INTO "media_outbox_events" ("topic", "payload") VALUES ($1, $2::jsonb)',
      [topic, JSON.stringify(payload)],
    );
  }
}
