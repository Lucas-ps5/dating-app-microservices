import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ImagesService } from "./images.service";
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from "@app/common";
import { objectNameToPath } from "@app/common/utils/utils";

const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
          description: "Usage context stored alongside the object",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload an image to MinIO" })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser("id") ownerId: string,
    @Query("context") context = "general",
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    return this.imagesService.uploadImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      ownerId,
      context,
    );
  }

  @Get("presign")
  @ApiOperation({ summary: "Get a presigned download URL for an object" })
  @ApiQuery({ name: "objectName", required: true })
  @ApiQuery({ name: "expires", required: false, example: 3600 })
  async getPresignedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Query("objectName") objectName: string,
    @Query("expires") expires = "3600",
  ) {
    if (!objectName) {
      throw new BadRequestException("objectName query param is required");
    }

    const requested = Number(expires);
    const expiresIn =
      Number.isFinite(requested) && requested > 0
        ? Math.min(requested, MAX_PRESIGN_EXPIRY_SECONDS)
        : MAX_PRESIGN_EXPIRY_SECONDS;

    const url = await this.imagesService.getPresignedUrl(
      objectName,
      user.id,
      user.roles,
      expiresIn,
    );
    return { url };
  }

  // Declared after `presign` so the literal path wins over the wildcard.
  @Get("*objectName")
  @ApiOperation({ summary: "Stream an image file" })
  @ApiProduces("image/png", "image/jpeg", "image/webp", "image/gif")
  async getImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("objectName") objectName: string | string[],
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType, size, fileName } =
      await this.imagesService.getImageStream(
        objectNameToPath(objectName),
        user.id,
        user.roles,
      );

    response.set({
      "Content-Type": contentType,
      "Content-Length": String(size),
      // objectName is server-generated (uuid) but originalName is user
      // supplied, so encode rather than interpolating it raw.
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    });

    return new StreamableFile(stream);
  }

  // path-to-regexp v8 (Nest 11) rejects the Express 4 `:param(*)` syntax.
  // A named wildcard still matches the `folder/name.ext` shape MinIO stores.
  @Delete("*objectName")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an image from MinIO" })
  async deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("objectName") objectName: string | string[],
  ) {
    await this.imagesService.deleteImage(
      objectNameToPath(objectName),
      user.id,
      user.roles,
    );
  }
}
