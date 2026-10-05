import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { MessagesService } from "./messages.service";
import { CurrentUser, JwtAuthGuard } from "@app/common";
import { SendMessageDto } from "./dto/message.dto";

@ApiTags("chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("my/conversations")
  @ApiOperation({ summary: "List conversations for the authenticated user" })
  async myConversations(@CurrentUser("id") userId: string) {
    return this.messagesService.getMyConversations(userId);
  }

  @Get("my/conversations/:conversationId")
  @ApiOperation({
    summary: "Get conversation by ID for the authenticated user",
  })
  async myConversation(
    @CurrentUser("id") userId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.messagesService.getConversationById(conversationId, userId);
  }

  @Post("conversations/send-message")
  @ApiOperation({
    summary: "Send a message",
  })
  async sendMessage(
    @CurrentUser("id") userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      userId,
      dto.receiverId,
      dto.content,
      dto.type,
    );
  }

  @Put("my/conversations/:conversationId/read")
  @ApiOperation({
    summary: "Mark messages as read in a conversation",
  })
  async readMessages(
    @CurrentUser("id") userId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.messagesService.readMessages(userId, conversationId);
  }

  @Get("my/unread/count")
  @ApiOperation({
    summary: "Get total unread messages count for the authenticated user",
  })
  async myUnreadCount(@CurrentUser("id") userId: string) {
    return this.messagesService.getAllMyUnreadMessagesCount(userId);
  }
}
