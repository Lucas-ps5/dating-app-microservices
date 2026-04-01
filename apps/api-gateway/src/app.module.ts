import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersProxyModule } from './users/users-proxy.module';
import { ChatProxyModule } from './chat/chat-proxy.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    AuthModule,
    UsersProxyModule,
    ChatProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
