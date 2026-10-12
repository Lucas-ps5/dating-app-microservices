import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  CreateBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { extname } from "path";
import type { Readable } from "stream";
import { errorMessage } from "@app/common";

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly publicRead: boolean;

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      this.configService.get<string>("objectStorage.bucket") ?? "hmeet-media";
    this.publicUrl =
      this.configService.get<string>("objectStorage.publicUrl") ??
      "http://localhost:9000";
    this.publicRead =
      this.configService.get<boolean>("objectStorage.publicRead") ?? false;

    const endpoint =
      this.configService.get<string>("objectStorage.endpoint") ?? "localhost";
    const port = this.configService.get<number>("objectStorage.port") ?? 9000;
    const useSSL =
      this.configService.get<boolean>("objectStorage.useSSL") ?? false;

    this.client = new S3Client({
      endpoint: `${useSSL ? "https" : "http"}://${endpoint}:${port}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId:
          this.configService.get<string>("objectStorage.accessKey") ??
          "minioadmin",
        secretAccessKey:
          this.configService.get<string>("objectStorage.secretKey") ??
          "minioadmin",
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(
        `Object storage initialization failed: ${errorMessage(err)} – continuing anyway`,
      );
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Object storage bucket ready: ${this.bucket}`);
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created object storage bucket: ${this.bucket}`);
    }

    if (this.publicRead) {
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "PublicReadObjects",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${this.bucket}/*`,
              },
            ],
          }),
        }),
      );
    }
  }

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
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectName,
          Body: buffer,
          ContentLength: buffer.length,
          ContentType: mimetype,
        }),
      );
    } catch (err) {
      this.logger.error(`Object storage upload failed: ${errorMessage(err)}`);
      throw new InternalServerErrorException("Failed to store image");
    }

    const url = `${this.publicUrl}/${this.bucket}/${objectName}`;
    this.logger.debug(`Uploaded ${objectName} (${buffer.length} bytes)`);
    return { objectName, url };
  }

  async presignedUrl(
    objectName: string,
    expiresSeconds = 3600,
  ): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: objectName }),
        { expiresIn: expiresSeconds },
      );
    } catch (err) {
      this.logger.error(`Presigned object URL failed: ${errorMessage(err)}`);
      throw new InternalServerErrorException(
        "Failed to generate presigned URL",
      );
    }
  }

  async getObjectStream(objectName: string): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectName }),
      );
      if (!result.Body || !("pipe" in result.Body)) {
        throw new Error("Object storage returned no readable stream");
      }
      return result.Body as Readable;
    } catch (err) {
      this.logger.error(`Object retrieval failed: ${errorMessage(err)}`);
      throw new NotFoundException(`Image ${objectName} not found`);
    }
  }

  async objectSize(objectName: string): Promise<number> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectName }),
      );
      return result.ContentLength ?? 0;
    } catch (err) {
      this.logger.error(`Object metadata lookup failed: ${errorMessage(err)}`);
      throw new NotFoundException(`Image ${objectName} not found`);
    }
  }

  async delete(objectName: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: objectName }),
      );
      this.logger.debug(`Deleted object: ${objectName}`);
    } catch (err) {
      this.logger.error(`Object deletion failed: ${errorMessage(err)}`);
      throw new InternalServerErrorException("Failed to delete image");
    }
  }
}
