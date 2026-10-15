import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";
import { ObjectStorageModule } from "./object-storage/object-storage.module";
import { KafkaModule } from "./kafka/kafka.module";
import mediaConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@app/common";
import { Image } from "./images/image.entity";
import { MediaOutboxEvent } from "./kafka/outbox-event.entity";
import { CreateMediaOutboxEvents1710000000000 } from "./migrations/1710000000000-create-media-outbox-events";

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
        entities: [Image, MediaOutboxEvent],
        migrations: [CreateMediaOutboxEvents1710000000000],
        migrationsRun: true,
        synchronize: config.get<string>("nodeEnv") !== "production",
        logging: config.get<string>("nodeEnv") === "development",
      }),
    }),
    ObjectStorageModule,
    KafkaModule,
    ImagesModule,
    AuthModule,
  ],
})
export class MediaAppModule {}
