import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export class HttpProxyService {
  private readonly logger = new Logger(HttpProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async proxy<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    serviceUrl: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<AxiosResponse<T>> {
    const url = `${serviceUrl}${path}`;
    const config: AxiosRequestConfig = {
      params: options.params,
      headers: options.headers,
    };

    this.logger.debug(`Proxying ${method.toUpperCase()} → ${url}`);

    try {
      switch (method) {
        case 'get':
          return await firstValueFrom(this.httpService.get<T>(url, config));
        case 'post':
          return await firstValueFrom(
            this.httpService.post<T>(url, options.body, config),
          );
        case 'put':
          return await firstValueFrom(
            this.httpService.put<T>(url, options.body, config),
          );
        case 'patch':
          return await firstValueFrom(
            this.httpService.patch<T>(url, options.body, config),
          );
        case 'delete':
          return await firstValueFrom(this.httpService.delete<T>(url, config));
      }
    } catch (error) {
      this.logger.error(`Proxy error for ${url}: ${error.message}`);
      throw error;
    }
  }
}
