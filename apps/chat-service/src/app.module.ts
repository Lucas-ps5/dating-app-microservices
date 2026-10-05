import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@app/common";
import { MatchesModule } from "./matches/matches.module";
import { MessagesModule } from "./messages/messages.module";
import { KafkaModule } from "./kafka/kafka.module";
import { KafkaProducerModule } from "./kafka/kafka-producer.module";
import { Match } from "./matches/match.entity";
import { Conversation } from "./messages/conversation.entity";
import { Message } from "./messages/message.entity";
import chatConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [chatConfiguration],
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
        entities: [Match, Conversation, Message],
        synchronize: config.get<string>("nodeEnv") !== "production",
        logging: config.get<string>("nodeEnv") === "development",
      }),
    }),
    KafkaModule,
    KafkaProducerModule,
    MatchesModule,
    MessagesModule,
    AuthModule,
  ],
})
export class ChatAppModule {}
