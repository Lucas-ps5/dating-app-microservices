import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Match } from "./entities/match.entity";
import { MatchesService } from "./matches.service";
import { KafkaModule } from "../src/kafka/kafka.module";

@Module({
  imports: [TypeOrmModule.forFeature([Match]), KafkaModule],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
