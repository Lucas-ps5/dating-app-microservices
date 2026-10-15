import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./user.entity";
import { UserSensitiveProfile } from "./user-sensitive-profile.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { KafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSensitiveProfile]),
    KafkaModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
