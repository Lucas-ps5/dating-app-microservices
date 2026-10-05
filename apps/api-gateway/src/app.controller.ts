import { Controller, Get, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  Public,
  Roles,
  RolesGuard,
} from "@app/common";

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
