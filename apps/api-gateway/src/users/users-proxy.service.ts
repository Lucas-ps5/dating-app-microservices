import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { AuthenticatedUser } from '../auth/interfaces/user.interface';

@Injectable()
export class UsersProxyService {
  private readonly serviceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceUrl =
      this.configService.get<string>('services.usersUrl') ??
      'http://localhost:3001/api';
  }

  async forward<T = unknown>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      user?: AuthenticatedUser;
    } = {},
  ): Promise<AxiosResponse<T>> {
    const url = `${this.serviceUrl}/users${path}`;
    const headers: Record<string, string> = {};

    if (options.user) {
      headers['x-user-id'] = options.user.userId;
      headers['x-user-email'] = options.user.email ?? '';
      headers['x-user-roles'] = options.user.roles.join(',');
    }

    const config: AxiosRequestConfig = { params: options.params, headers };

    switch (method) {
      case 'get':
        return firstValueFrom(this.httpService.get<T>(url, config));
      case 'post':
        return firstValueFrom(
          this.httpService.post<T>(url, options.body, config),
        );
      case 'patch':
        return firstValueFrom(
          this.httpService.patch<T>(url, options.body, config),
        );
      case 'put':
        return firstValueFrom(
          this.httpService.put<T>(url, options.body, config),
        );
      case 'delete':
        return firstValueFrom(this.httpService.delete<T>(url, config));
    }
  }
}
