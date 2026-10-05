import {
  Controller,
  Post,
  Get,
  Delete,
  Headers,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from "@app/common";
import { MediaProxyService } from "./media-proxy.service";

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("media")
export class MediaController {
  constructor(private readonly mediaProxy: MediaProxyService) {}

  @Post("images")
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Only image files are allowed"), false);
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
      },
    },
  })
  @ApiOperation({ summary: "Upload an image â€” stored in MinIO" })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Query("context") context = "general",
  ) {
    if (!file) throw new BadRequestException("No file provided");
    const res = await this.mediaProxy.uploadImage(
      file,
      user,
      authorization,
      context,
    );
    return res.data;
  }

  @Get("images/presign")
  @ApiOperation({
    summary: "Get a presigned download URL for a private object",
  })
  @ApiQuery({ name: "objectName", required: true })
  @ApiQuery({ name: "expires", required: false, example: 3600 })
  async getPresignedUrl(
    @Query("objectName") objectName: string,
    @Query("expires") expires = "3600",
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
  ) {
    if (!objectName) throw new BadRequestException("objectName is required");
    const res = await this.mediaProxy.getPresignedUrl(
      objectName,
      +expires,
      user,
      authorization,
    );
    return res.data;
  }

  @Delete("images/*objectName")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an image from MinIO" })
  async deleteImage(
    @Param("objectName") objectName: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
  ) {
    await this.mediaProxy.deleteImage(objectName, user, authorization);
  }
}
