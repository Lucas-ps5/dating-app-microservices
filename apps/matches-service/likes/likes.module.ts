import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MatchesModule } from "../matches/matches.module";
import { LikesController } from "./likes.controller";
import { Like } from "./entities/like.entity";
import { LikesService } from "./likes.service";

@Module({
  imports: [TypeOrmModule.forFeature([Like]), MatchesModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
