import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { httpLoggingMiddleware } from "@app/common";
import { NotificationsAppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("NotificationsService");
  const app = await NestFactory.create(NotificationsAppModule);
  app.use(httpLoggingMiddleware);

  const configService = app.get(ConfigService);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.setGlobalPrefix("api");

  const port = configService.get<number>("port") ?? 3005;
  await app.listen(port);
  logger.log(
    `Notifications Service running on: http://localhost:${port}/api`,
  );
}
void bootstrap();
