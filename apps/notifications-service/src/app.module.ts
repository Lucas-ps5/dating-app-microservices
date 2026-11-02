import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@app/common";
import notificationsConfiguration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";
import { Notification } from "./notifications/notification.entity";
import { NotificationsModule } from "./notifications/notifications.module";
import { KafkaModule } from "./kafka/kafka.module";
import { CreateNotificationsTable1762120000000 } from "./migrations/1762120000000-create-notifications-table";
import { AddNotificationSource1762120001000 } from "./migrations/1762120001000-add-notification-source";
import { TypeNotificationType1762120002000 } from "./migrations/1762120002000-type-notification-type";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [notificationsConfiguration],
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
        entities: [Notification],
        migrations: [
          CreateNotificationsTable1762120000000,
          AddNotificationSource1762120001000,
          TypeNotificationType1762120002000,
        ],
        migrationsRun: true,
        synchronize: false,
        logging: config.get<string>("nodeEnv") === "development",
      }),
    }),
    KafkaModule,
    NotificationsModule,
    AuthModule,
  ],
})
export class NotificationsAppModule {}
