import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  Body,
  Put,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MessagesService } from "./messages.service";
import { UserHeaders } from "@app/common/types/types";
import { SendMessageDto } from "./dto/message.dto";

@ApiTags("chat")
@Controller("chat")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("my/conversations")
  @ApiOperation({ summary: "List conversations for the authenticated user" })
  async myConversations(@Headers(UserHeaders.USER_ID) userId: string) {
    return this.messagesService.getMyConversations(userId);
  }

  @Get("my/conversations/:conversationId")
  @ApiOperation({
    summary: "Get conversation by ID for the authenticated user",
  })
  async myConversation(@Param("conversationId") conversationId: string) {
    return this.messagesService.getConversationById(conversationId);
  }

  @Post("conversations/send-message")
  @ApiOperation({
    summary: "Send a message",
  })
  async sendMessage(
    @Headers(UserHeaders.USER_ID) userId: string,
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
    @Headers(UserHeaders.USER_ID) userId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.messagesService.readMessages(userId, conversationId);
  }

  @Get("my/unread/count")
  @ApiOperation({
    summary: "Get total unread messages count for the authenticated user",
  })
  async myUnreadCount(@Headers(UserHeaders.USER_ID) userId: string) {
    return this.messagesService.getAllMyUnreadMessagesCount(userId);
  }
}
