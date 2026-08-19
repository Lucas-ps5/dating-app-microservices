import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

interface PublicProxyRoute {
  method: string;
  segments: string[];
}

const PUBLIC_PROXY_ROUTES: PublicProxyRoute[] = [
  { method: "POST", segments: ["user", "register"] },
  { method: "POST", segments: ["users", "register"] },
];

@Injectable()
export class PublicProxyRoutesGuard extends JwtAuthGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (this.isPublicProxyRoute(request)) {
      return true;
    }

    return super.canActivate(context);
  }

  private isPublicProxyRoute(request: Request) {
    const method = request.method.toUpperCase();
    const segments = request.path.split("/").filter(Boolean);
    const apiIndex = segments[0] === "api" ? 1 : 0;
    const routeSegments = segments.slice(apiIndex);

    return PUBLIC_PROXY_ROUTES.some(
      (route) =>
        route.method === method &&
        route.segments.length === routeSegments.length &&
        route.segments.every(
          (segment, index) => segment === routeSegments[index],
        ),
    );
  }
}
