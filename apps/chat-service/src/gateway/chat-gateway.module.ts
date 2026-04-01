import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [MessagesModule, MatchesModule],
  providers: [ChatGateway],
})
export class ChatGatewayModule {}
