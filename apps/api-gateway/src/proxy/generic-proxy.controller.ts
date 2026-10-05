import {
  All,
  Controller,
  HttpStatus,
  MethodNotAllowedException,
  NotFoundException,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthenticatedUser } from "@app/common";
import {
  HttpProxyService,
  type ProxyHttpMethod,
} from "../common/http-proxy.service";
import { PublicProxyRoutesGuard } from "./public-proxy-routes.guard";
import { UserHeaders } from "@app/common/types/types";

interface ServiceRoute {
  url: string;
  targetPrefix: string;
}

@ApiTags("proxy")
@ApiBearerAuth()
@ApiExcludeController()
@UseGuards(PublicProxyRoutesGuard)
@Controller()
export class GenericProxyController {
  private readonly services: Record<string, ServiceRoute>;

  constructor(
    private readonly proxy: HttpProxyService,
    configService: ConfigService,
  ) {
    this.services = {
      user: {
        url:
          configService.get<string>("services.usersUrl") ??
          "http://localhost:3001/api",
        targetPrefix: "user",
      },
      users: {
        url:
          configService.get<string>("services.usersUrl") ??
          "http://localhost:3001/api",
        targetPrefix: "user",
      },
      chat: {
        url:
          configService.get<string>("services.chatUrl") ??
          "http://localhost:3002/api",
        targetPrefix: "chat",
      },
      matches: {
        url:
          configService.get<string>("services.matchesUrl") ??
          "http://localhost:3004/api",
        targetPrefix: "matches",
      },
      likes: {
        url:
          configService.get<string>("services.matchesUrl") ??
          "http://localhost:3004/api",
        targetPrefix: "likes",
      },
    };
  }

  // Nest only honours the LAST route decorator on a method, so each proxied
  // prefix needs its own method. They all delegate to `forward`.
  @All("user")
  forwardUserRoot(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("user/*path")
  forwardUser(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("users")
  forwardUsersRoot(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("users/*path")
  forwardUsers(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("chat")
  forwardChatRoot(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("chat/*path")
  forwardChat(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("matches")
  forwardMatchesRoot(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("matches/*path")
  forwardMatches(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("likes")
  forwardLikesRoot(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @All("likes/*path")
  forwardLikes(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  private async forward(request: Request, response: Response) {
    const body = request.body as unknown;
    const query = request.query as Record<string, unknown>;
    const user = (request as Request & { user?: AuthenticatedUser }).user;
    const authorization = request.headers.authorization;
    const { serviceName, path } = this.parseServicePath(request.path);
    const service = serviceName ? this.services[serviceName] : undefined;
    if (!service) {
      throw new NotFoundException(`Unknown service route: ${request.path}`);
    }

    const method = request.method.toLowerCase();
    if (!this.isProxyMethod(method)) {
      throw new MethodNotAllowedException(
        `Method ${request.method} is not proxied by the gateway`,
      );
    }

    const proxied = await this.proxy.proxy(
      method,
      service.url,
      this.buildTargetPath(service.targetPrefix, path),
      {
        body,
        params: query,
        headers: this.userHeaders(user, authorization),
      },
    );

    if (proxied.status === Number(HttpStatus.NO_CONTENT)) {
      return response.status(proxied.status).send();
    }

    return response.status(proxied.status).send(proxied.data);
  }

  private parseServicePath(requestPath: string) {
    const segments = requestPath.split("/").filter(Boolean);
    const serviceIndex = segments.findIndex(
      (segment) => this.services[segment],
    );

    if (serviceIndex === -1) {
      return { serviceName: undefined, path: [] };
    }

    return {
      serviceName: segments[serviceIndex],
      path: segments.slice(serviceIndex + 1),
    };
  }

  private buildTargetPath(prefix: string, path: string[]) {
    return `/${[prefix, ...path].filter(Boolean).join("/")}`;
  }

  /**
   * Forwards the caller's original bearer token so each backend service can
   * verify the JWT itself. The `x-user-*` headers are kept for logging and
   * backwards compatibility only — no service trusts them for authorisation.
   */
  private userHeaders(
    user?: AuthenticatedUser,
    authorization?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    if (authorization) {
      headers.authorization = authorization;
    }
    if (!user) return headers;

    return {
      ...headers,
      [UserHeaders.USER_ID]: user.id,
      [UserHeaders.USER_EMAIL]: user.email ?? "",
      [UserHeaders.USER_ROLES]: user.roles.join(","),
    };
  }

  private isProxyMethod(method: string): method is ProxyHttpMethod {
    return ["get", "post", "put", "patch", "delete"].includes(method);
  }
}
