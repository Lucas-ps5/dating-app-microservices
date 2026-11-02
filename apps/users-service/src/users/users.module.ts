import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./user.entity";
import { UserSensitiveProfile } from "./user-sensitive-profile.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { KafkaModule } from "../kafka/kafka.module";
import { PresenceService } from "./presence.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSensitiveProfile]),
    KafkaModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, PresenceService],
  exports: [UsersService, PresenceService],
})
export class UsersModule {}
