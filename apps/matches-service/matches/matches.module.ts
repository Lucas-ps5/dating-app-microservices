import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Like } from "../likes/entities/like.entity";
import { Match } from "./entities/match.entity";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { KafkaModule } from "../src/kafka/kafka.module";

@Module({
  imports: [TypeOrmModule.forFeature([Match, Like]), KafkaModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
