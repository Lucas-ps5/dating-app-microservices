import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "./message.entity";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { KafkaProducerModule } from "../kafka/kafka-producer.module";
import { MatchesModule } from "../matches/matches.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    KafkaProducerModule,
    MatchesModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
