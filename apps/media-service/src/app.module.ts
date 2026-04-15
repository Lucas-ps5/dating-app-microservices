import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";
import { MinioModule } from "./minio/minio.module";
import { KafkaModule } from "./kafka/kafka.module";
import mediaConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Image } from "./images/image.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [mediaConfiguration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("database.host"),
        port: config.get<number>("database.port"),
        username: config.get<string>("database.username"),
        password: config.get<string>("database.password"),
        database: config.get<string>("database.name"),
        entities: [Image],
        synchronize: config.get<string>("nodeEnv") !== "production",
        logging: config.get<string>("nodeEnv") === "development",
      }),
    }),
    MinioModule,
    KafkaModule,
    ImagesModule,
  ],
})
export class MediaAppModule {}
