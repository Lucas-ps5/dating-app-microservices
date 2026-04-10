import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";
import { MinioModule } from "./minio/minio.module";
import { KafkaModule } from "./kafka/kafka.module";
import mediaConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [mediaConfiguration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    MinioModule,
    KafkaModule,
    ImagesModule,
  ],
})
export class MediaAppModule {}
