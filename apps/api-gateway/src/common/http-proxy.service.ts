import { HttpException, Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import {
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";

export type ProxyHttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface ProxyOptions {
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

@Injectable()
export class HttpProxyService {
  private readonly logger = new Logger(HttpProxyService.name);

  constructor(private readonly httpService: HttpService) {}

  async proxy<T>(
    method: ProxyHttpMethod,
    serviceUrl: string,
    path: string,
    options: ProxyOptions = {},
  ): Promise<AxiosResponse<T>> {
    const url = `${serviceUrl}${path}`;
    const config: AxiosRequestConfig = {
      params: options.params,
      headers: options.headers,
    };

    this.logger.debug(`Proxying ${method.toUpperCase()} -> ${url}`);

    try {
      switch (method) {
        case "get":
          return await firstValueFrom(this.httpService.get<T>(url, config));
        case "post":
          return await firstValueFrom(
            this.httpService.post<T>(url, options.body, config),
          );
        case "put":
          return await firstValueFrom(
            this.httpService.put<T>(url, options.body, config),
          );
        case "patch":
          return await firstValueFrom(
            this.httpService.patch<T>(url, options.body, config),
          );
        case "delete":
          return await firstValueFrom(this.httpService.delete<T>(url, config));
      }
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response) {
        this.logger.error(`Proxy error for ${url}: ${error.response.status}`);
        throw new HttpException(error.response.data, error.response.status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Proxy error for ${url}: ${message}`);
      throw error;
    }
  }
}
