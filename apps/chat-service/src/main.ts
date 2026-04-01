import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('ChatService');
  const app = await NestFactory.create(ChatAppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  app.enableCors({ origin: '*', credentials: true });

  const port = configService.get<number>('port') ?? 3002;
  await app.listen(port);

  logger.log(`🚀 Chat Service running on: http://localhost:${port}/api`);
  logger.log(`🔌 WebSocket available at:  ws://localhost:${port}`);
}
void bootstrap();
