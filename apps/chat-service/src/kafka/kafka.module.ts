import { Module } from "@nestjs/common";
import { KafkaConsumerService } from "./kafka-consumer.service";
import { MatchesModule } from "../matches/matches.module";
import { ConversationsModule } from "../messages/conversations.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "../messages/message.entity";
import { Conversation } from "../messages/conversation.entity";

@Module({
  imports: [
    MatchesModule,
    ConversationsModule,
    TypeOrmModule.forFeature([Message, Conversation]),
  ],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
