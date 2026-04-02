import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/user.interface";
import { ChatProxyService } from "./chat-proxy.service";

@ApiTags("chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(private readonly chatProxy: ChatProxyService) {}

  @Get("conversations")
  @ApiOperation({ summary: "List my conversations" })
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    const res = await this.chatProxy.forward("get", "/conversations", {
      user,
      params: { ...query, userId: user.userId },
    });
    return res.data;
  }

  @Get("conversations/:matchId/messages")
  @ApiOperation({ summary: "Get messages for a conversation" })
  async getMessages(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    const res = await this.chatProxy.forward(
      "get",
      `/conversations/${matchId}/messages`,
      { user, params: query },
    );
    return res.data;
  }

  @Post("matches/:userId")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a match with another user" })
  async createMatch(
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.chatProxy.forward("post", "/matches", {
      user,
      body: { user1Id: user.userId, user2Id: targetUserId },
    });
    return res.data;
  }

  @Get("matches")
  @ApiOperation({ summary: "List my matches" })
  async listMatches(@CurrentUser() user: AuthenticatedUser) {
    const res = await this.chatProxy.forward("get", "/matches", {
      user,
      params: { userId: user.userId },
    });
    return res.data;
  }
}
