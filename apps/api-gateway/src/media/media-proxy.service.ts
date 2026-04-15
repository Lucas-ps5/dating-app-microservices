import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require("form-data") as typeof import("form-data");
import type { AxiosResponse } from "axios";
import type { AuthenticatedUser } from "../auth/interfaces/user.interface";

export interface UploadImageResponse {
  url: string;
  objectName: string;
}

export interface PresignedUrlResponse {
  url: string;
}

@Injectable()
export class MediaProxyService {
  private readonly logger = new Logger(MediaProxyService.name);
  private readonly serviceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceUrl =
      this.configService.get<string>("services.mediaUrl") ??
      "http://localhost:3003/api";
  }

  private userHeaders(user?: AuthenticatedUser): Record<string, string> {
    if (!user) return {};
    return {
      "x-user-id": user.userId,
      "x-user-email": user.email ?? "",
      "x-user-roles": user.roles.join(","),
    };
  }

  async uploadImage(
    file: Express.Multer.File,
    user: AuthenticatedUser,
    context = "general",
  ): Promise<AxiosResponse<UploadImageResponse>> {
    const form = new FormData();
    form.append("photo", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const url = `${this.serviceUrl}/media/images?context=${encodeURIComponent(context)}`;
    this.logger.debug(`Streaming upload to media-service: ${url}`);

    return firstValueFrom(
      this.httpService.post(url, form, {
        headers: {
          ...form.getHeaders(),
          ...this.userHeaders(user),
        },
      }),
    );
  }

  async getPresignedUrl(
    objectName: string,
    expires = 3600,
    user: AuthenticatedUser,
  ): Promise<AxiosResponse<PresignedUrlResponse>> {
    return firstValueFrom(
      this.httpService.get(`${this.serviceUrl}/media/images/presign`, {
        params: { objectName, expires },
        headers: this.userHeaders(user),
      }),
    );
  }

  async deleteImage(
    objectName: string,
    user: AuthenticatedUser,
  ): Promise<AxiosResponse<void>> {
    return firstValueFrom(
      this.httpService.delete(
        `${this.serviceUrl}/media/images/${encodeURIComponent(objectName)}`,
        { headers: this.userHeaders(user) },
      ),
    );
  }
}
