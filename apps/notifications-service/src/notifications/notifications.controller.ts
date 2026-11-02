import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from "@app/common";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications" })
  list(@CurrentUser() user: AuthenticatedUser, @Query("limit") limit?: string) {
    return this.notificationsService.listForUser(
      user.id,
      limit ? Number(limit) : 50,
    );
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Count unread notifications" })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.countUnread(user.id);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a notification as read" })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
