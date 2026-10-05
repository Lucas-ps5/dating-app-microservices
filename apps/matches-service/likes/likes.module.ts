import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Like } from "./entities/like.entity";
import { LikesController } from "./likes.controller";
import { LikesService } from "./likes.service";
import { MatchesModule } from "../matches/matches.module";
import { KafkaModule } from "../src/kafka/kafka.module";

@Module({
  imports: [TypeOrmModule.forFeature([Like]), MatchesModule, KafkaModule],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
