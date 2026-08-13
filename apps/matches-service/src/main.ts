import { NestFactory } from "@nestjs/core";
import { MatchesAppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(MatchesAppModule);
  await app.listen(process.env.port ?? 3004);
}
bootstrap();
