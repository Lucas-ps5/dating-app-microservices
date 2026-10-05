import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MatchesAppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("MatchesService");
  const app = await NestFactory.create(MatchesAppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.setGlobalPrefix("api");

  const port = configService.get<number>("port") ?? 3004;
  await app.listen(port);

  logger.log(`Matches Service running on: http://localhost:${port}/api`);
}
void bootstrap();
