import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { rethrowUpstreamError } from "./http-error";

export type ProxyHttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface ProxyOptions {
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Overrides the default per-request timeout, e.g. for large uploads. */
  timeoutMs?: number;
}

/**
 * Without a timeout a hung downstream service stalls the gateway request
 * handler indefinitely, tying up sockets and exhausting the connection pool.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

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
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
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
      this.logger.error(`Proxy error for ${url}`);
      rethrowUpstreamError(error);
    }
  }
}
