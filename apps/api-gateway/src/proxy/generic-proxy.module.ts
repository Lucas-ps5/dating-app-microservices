import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { HttpProxyService } from "../common/http-proxy.service";
import { GenericProxyController } from "./generic-proxy.controller";
import { PublicProxyRoutesGuard } from "./public-proxy-routes.guard";

@Module({
  imports: [HttpModule],
  controllers: [GenericProxyController],
  providers: [HttpProxyService, PublicProxyRoutesGuard],
})
export class GenericProxyModule {}
