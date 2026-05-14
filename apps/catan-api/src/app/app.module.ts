import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { BearerSessionGuard } from './http/guards/bearer-session.guard';
import { ApiStandardHttpInterceptor } from './http/interceptors/api-standard-http.interceptor';

@Module({
  imports: [GameModule],
  controllers: [AppController],
  providers: [
    AppService,
    BearerSessionGuard,
    { provide: APP_INTERCEPTOR, useClass: ApiStandardHttpInterceptor },
  ],
})
export class AppModule {}
