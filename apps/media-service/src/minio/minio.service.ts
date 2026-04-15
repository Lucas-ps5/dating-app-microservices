import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      this.configService.get<string>("minio.bucket") ?? "hmeet-media";
    this.publicUrl =
      this.configService.get<string>("minio.publicUrl") ??
      "http://localhost:9000";

    this.client = new Minio.Client({
      endPoint: this.configService.get<string>("minio.endpoint") ?? "localhost",
      port: this.configService.get<number>("minio.port") ?? 9000,
      useSSL: this.configService.get<boolean>("minio.useSSL") ?? false,
      accessKey:
        this.configService.get<string>("minio.accessKey") ?? "minioadmin",
      secretKey:
        this.configService.get<string>("minio.secretKey") ?? "minioadmin",
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(`MinIO init failed: ${err.message} – continuing anyway`);
    }
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Created MinIO bucket: ${this.bucket}`);
    } else {
      this.logger.log(`MinIO bucket ready: ${this.bucket}`);
    }
  }

  /**
   * Upload a file buffer to MinIO.
   * @returns { objectName, url }
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    name: string,
    mimetype: string,
    folder = "general",
  ): Promise<{ objectName: string; url: string }> {
    const ext = extname(originalName) || ".bin";
    const objectName = `${folder}/${name}${ext}`;

    try {
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          "Content-Type": mimetype,
        },
      );
    } catch (err) {
      this.logger.error(`MinIO putObject failed: ${err.message}`);
      throw new InternalServerErrorException("Failed to store image");
    }

    const url = `${this.publicUrl}/${this.bucket}/${objectName}`;
    this.logger.debug(`Uploaded ${objectName} (${buffer.length} bytes)`);
    return { objectName, url };
  }

  /**
   * Generate a pre-signed GET URL (defaults to 1 hour)
   */
  async presignedUrl(
    objectName: string,
    expiresSeconds = 3600,
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(
        this.bucket,
        objectName,
        expiresSeconds,
      );
    } catch (err) {
      this.logger.error(`presignedGetObject failed: ${err.message}`);
      throw new InternalServerErrorException(
        "Failed to generate presigned URL",
      );
    }
  }

  /**
   * Delete an object from MinIO
   */
  async delete(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
      this.logger.debug(`Deleted object: ${objectName}`);
    } catch (err) {
      this.logger.error(`MinIO removeObject failed: ${err.message}`);
      throw new InternalServerErrorException("Failed to delete image");
    }
  }
}
