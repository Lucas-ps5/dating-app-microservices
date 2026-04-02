import { Controller, Get, Post, Param, Query, Headers } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MessagesService } from "./messages.service";
import { MatchesService } from "../matches/matches.service";

@ApiTags("chat/conversations")
@Controller("chat/conversations")
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly matchesService: MatchesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List conversations (matches + last message)" })
  async listConversations(@Query("userId") userId: string) {
    const matches = await this.matchesService.findMatchesForUser(userId);
    const conversations = await Promise.all(
      matches.map(async (match) => {
        const lastMessage = await this.messagesService.getLastMessage(match.id);
        return { match, lastMessage };
      }),
    );
    return conversations;
  }

  @Get(":matchId/messages")
  @ApiOperation({ summary: "Get messages for a match (paginated)" })
  async getMessages(
    @Param("matchId") matchId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Headers("x-user-id") userId: string,
  ) {
    // Validate participant access
    await this.matchesService.validateParticipant(matchId, userId);
    return this.messagesService.getMessages(matchId, +page, +limit);
  }

  @Post(":matchId/read")
  @ApiOperation({ summary: "Mark messages in a match as read" })
  async markAsRead(
    @Param("matchId") matchId: string,
    @Headers("x-user-id") userId: string,
  ) {
    await this.messagesService.markAsRead(matchId, userId);
    return { success: true };
  }
}
