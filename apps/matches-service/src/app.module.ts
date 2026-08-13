import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import matchesConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";
import { Like } from "../likes/entities/like.entity";
import { KafkaModule } from "./kafka/kafka.module";
import { LikesModule } from "../likes/likes.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [matchesConfiguration],
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
        entities: [Like],
        synchronize: config.get<string>("nodeEnv") !== "production",
        logging: config.get<string>("nodeEnv") === "development",
      }),
    }),
    KafkaModule,
    LikesModule,
  ],
})
export class MatchesAppModule {}
