import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { MediaAppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("MediaService");
  const app = await NestFactory.create(MediaAppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("HMeet Media Service")
    .setDescription("Image upload, retrieval & deletion via MinIO")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = configService.get<number>("port") ?? 3003;
  await app.listen(port);

  logger.log(`🖼️  Media Service running on: http://localhost:${port}/api`);
}
void bootstrap();
