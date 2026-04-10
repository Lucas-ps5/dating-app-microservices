import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { MediaController } from "./media.controller";
import { MediaProxyService } from "./media-proxy.service";

@Module({
  imports: [HttpModule],
  controllers: [MediaController],
  providers: [MediaProxyService],
})
export class MediaProxyModule {}
