import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersAppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("UsersService");
  const app = await NestFactory.create(UsersAppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.setGlobalPrefix("api");

  const port = configService.get<number>("port") ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Users Service running on: http://localhost:${port}/api`);
}
void bootstrap();
