import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import {
  AuthenticatedUser,
  RequestWithUser,
} from "./interfaces/authenticated-user.interface";

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";

/** Marks a route as reachable without a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires the caller to hold at least one of the listed roles.
 * Semantics are OR: any one match grants access.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Injects the verified identity. Pass a field name to pull out a single
 * property, e.g. `@CurrentUser("id") userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
