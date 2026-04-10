import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Headers,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { ImagesService } from "./images.service";

const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags("media")
@Controller("media/images")
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(), // File lives in memory — MinIO handles persistence
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type not allowed. Accepted: ${ALLOWED_MIMETYPES.join(", ")}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["photo"],
      properties: {
        photo: { type: "string", format: "binary" },
        context: {
          type: "string",
          example: "profile-photo",
          description: "Usage context stored with the Kafka event",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload an image to MinIO" })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers("x-user-id") ownerId: string,
    @Query("context") context = "general",
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    return this.imagesService.uploadImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      ownerId ?? "anonymous",
      context,
    );
  }

  @Get("presign")
  @ApiOperation({ summary: "Get a presigned download URL for an object" })
  @ApiQuery({ name: "objectName", required: true })
  @ApiQuery({ name: "expires", required: false, example: 3600 })
  async getPresignedUrl(
    @Query("objectName") objectName: string,
    @Query("expires") expires = "3600",
  ) {
    if (!objectName) {
      throw new BadRequestException("objectName query param is required");
    }
    const url = await this.imagesService.getPresignedUrl(objectName, +expires);
    return { url };
  }

  @Delete(":objectName(*)")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an image from MinIO" })
  async deleteImage(
    @Param("objectName") objectName: string,
    @Headers("x-user-id") ownerId: string,
  ) {
    await this.imagesService.deleteImage(objectName, ownerId ?? "anonymous");
  }
}
