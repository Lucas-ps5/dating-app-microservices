import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { MatchesAppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(MatchesAppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix("api");

  const port = configService.get<number>("port") ?? 3004;
  await app.listen(port);
}
void bootstrap();
