import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
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
import type { Response } from "express";
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from "@app/common";
import { errorMessage, objectNameToPath } from "@app/common/utils/utils";
import { MediaProxyService } from "./media-proxy.service";

@ApiTags("media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("media")
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

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

  @Get("images/*objectName")
  @ApiOperation({ summary: "Stream an image file" })
  @ApiProduces("image/png", "image/jpeg", "image/webp", "image/gif")
  async getImage(
    @Param("objectName") objectName: string | string[],
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const upstream = await this.mediaProxy.getImage(
      objectNameToPath(objectName),
      user,
      authorization,
    );

    // Errors come back as JSON, but `responseType: "stream"` means the body is
    // a stream too, so it has to be drained before it can be re-sent.
    if (upstream.status >= 400) {
      const body = await this.readErrorBody(upstream.data);
      response.status(upstream.status).json(body);
      return;
    }

    for (const header of [
      "content-type",
      "content-length",
      "cache-control",
      // Only relayed for a real image, never on the error path above.
      "content-disposition",
    ]) {
      const value = this.headerValue(upstream.headers, header);
      if (value !== undefined) {
        response.setHeader(header, value);
      }
    }

    const stream = upstream.data;
    stream.on("error", (err) => {
      this.logger.error(`Image stream aborted: ${errorMessage(err)}`);
      response.destroy();
    });
    stream.pipe(response);
  }

  /**
   * Reads a header that axios exposes as `any`. Values are coerced to a string
   * because node accepts a number or array for a few headers, and an upstream
   * must never be able to inject a non-string into `setHeader`.
   */
  private headerValue(headers: unknown, name: string): string | undefined {
    if (typeof headers !== "object" || headers === null) return undefined;
    const value: unknown = (headers as Record<string, unknown>)[name];
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value.map(String).join(", ");
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    // A structured header value is not something node accepts; drop it rather
    // than stringify an object into "[object Object]".
    return undefined;
  }

  /** Buffers a streamed error body and returns it as JSON, or as-is if it is
   * not parseable. Small payloads only, since these are error responses. */
  private async readErrorBody(
    data: NodeJS.ReadableStream,
  ): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { statusCode: 500, message: raw || "Upstream error" };
    }
  }

  @Delete("images/*objectName")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an image from MinIO" })
  async deleteImage(
    @Param("objectName") objectName: string | string[],
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
  ) {
    await this.mediaProxy.deleteImage(
      objectNameToPath(objectName),
      user,
      authorization,
    );
  }
}
