import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { MediaProxyModule } from "./media/media-proxy.module";
import { GenericProxyModule } from "./proxy/generic-proxy.module";
import configuration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || "development"}`, ".env"],
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    AuthModule,
    MediaProxyModule,
    GenericProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
