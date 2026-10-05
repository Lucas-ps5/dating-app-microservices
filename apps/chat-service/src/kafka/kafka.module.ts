import { Module } from "@nestjs/common";
import { KafkaConsumerService } from "./kafka-consumer.service";
import { MatchesModule } from "../matches/matches.module";
import { ConversationsModule } from "../messages/conversations.module";

@Module({
  imports: [MatchesModule, ConversationsModule],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
