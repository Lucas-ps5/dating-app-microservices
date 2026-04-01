import { Controller, Get, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import { Public } from "./auth/decorators/public.decorator";
import { Roles } from "./auth/decorators/roles.decorator";
import { CurrentUser } from "./auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import type { AuthenticatedUser } from "./auth/interfaces/user.interface";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get("health")
  healthCheck() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("profile")
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: "This is a protected route",
      user,
    };
  }

  @Get("admin")
  @Roles("admin")
  getAdminData(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: "This route requires admin role",
      user,
    };
  }

  @Get("user-or-moderator")
  @Roles("user", "moderator")
  getUserOrModeratorData(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: "This route requires user OR moderator role",
      user,
    };
  }
}
