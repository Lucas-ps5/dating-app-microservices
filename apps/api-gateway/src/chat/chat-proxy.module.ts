import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatProxyService } from './chat-proxy.service';

@Module({
  imports: [HttpModule],
  controllers: [ChatController],
  providers: [ChatProxyService],
})
export class ChatProxyModule {}
