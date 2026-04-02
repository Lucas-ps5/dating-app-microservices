import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { UsersController } from "./users.controller";
import { UsersProxyService } from "./users-proxy.service";

@Module({
  imports: [HttpModule],
  controllers: [UsersController],
  providers: [UsersProxyService],
})
export class UsersProxyModule {}
