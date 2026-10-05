import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require("form-data") as typeof import("form-data");
import { type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { AuthenticatedUser } from "@app/common";
import { rethrowUpstreamError } from "../common/http-error";

export interface UploadImageResponse {
  url: string;
  objectName: string;
}

export interface PresignedUrlResponse {
  url: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Uploads carry a file in memory, so allow noticeably more headroom. */
const UPLOAD_TIMEOUT_MS = 60_000;

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

  /**
   * Downstream services now verify the access token themselves, so the
   * original `Authorization` header is forwarded rather than the old
   * forgeable `x-user-*` identity headers.
   */
  private passthroughHeaders(
    user: AuthenticatedUser,
    authorization?: string,
  ): Record<string, string> {
    return {
      ...(authorization ? { authorization } : {}),
      "x-user-id": user.id,
      "x-user-email": user.email ?? "",
      "x-user-roles": user.roles.join(","),
    };
  }

  private async call<T>(
    makeRequest: () => Promise<AxiosResponse<T>>,
    url: string,
  ): Promise<AxiosResponse<T>> {
    try {
      return await makeRequest();
    } catch (error) {
      this.logger.error(`Media proxy error for ${url}`);
      rethrowUpstreamError(error);
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    user: AuthenticatedUser,
    authorization?: string,
    context = "general",
  ): Promise<AxiosResponse<UploadImageResponse>> {
    const form = new FormData();
    form.append("photo", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const url = `${this.serviceUrl}/media/images?context=${encodeURIComponent(context)}`;
    this.logger.debug(`Streaming upload to media-service: ${url}`);

    const config: AxiosRequestConfig = {
      timeout: UPLOAD_TIMEOUT_MS,
      headers: {
        ...form.getHeaders(),
        ...this.passthroughHeaders(user, authorization),
      },
    };

    return this.call(
      () => firstValueFrom(this.httpService.post(url, form, config)),
      url,
    );
  }

  async getPresignedUrl(
    objectName: string,
    expires: number,
    user: AuthenticatedUser,
    authorization?: string,
  ): Promise<AxiosResponse<PresignedUrlResponse>> {
    const url = `${this.serviceUrl}/media/images/presign`;
    const config: AxiosRequestConfig = {
      timeout: DEFAULT_TIMEOUT_MS,
      params: { objectName, expires },
      headers: this.passthroughHeaders(user, authorization),
    };

    return this.call(
      () => firstValueFrom(this.httpService.get(url, config)),
      url,
    );
  }

  /**
   * Fetches image bytes from media-service. `responseType: "stream"` keeps the
   * gateway from buffering the whole file, and `validateStatus` lets error
   * bodies (404/403 JSON) come back as a normal response for `call` to
   * translate rather than an axios throw.
   */
  async getImage(
    objectName: string,
    user: AuthenticatedUser,
    authorization?: string,
  ): Promise<AxiosResponse<NodeJS.ReadableStream>> {
    const url = `${this.serviceUrl}/media/images/${encodeURIComponent(objectName)}`;
    const config: AxiosRequestConfig = {
      timeout: DEFAULT_TIMEOUT_MS,
      responseType: "stream",
      validateStatus: () => true,
      headers: this.passthroughHeaders(user, authorization),
    };

    return this.call(
      () => firstValueFrom(this.httpService.get(url, config)),
      url,
    );
  }

  async deleteImage(
    objectName: string,
    user: AuthenticatedUser,
    authorization?: string,
  ): Promise<AxiosResponse<void>> {
    const url = `${this.serviceUrl}/media/images/${encodeURIComponent(objectName)}`;
    const config: AxiosRequestConfig = {
      timeout: DEFAULT_TIMEOUT_MS,
      headers: this.passthroughHeaders(user, authorization),
    };

    return this.call(
      () => firstValueFrom(this.httpService.delete(url, config)),
      url,
    );
  }
}
