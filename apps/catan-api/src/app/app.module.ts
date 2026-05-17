import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { BearerSessionGuard } from './http/guards/bearer-session.guard';
import { ApiHttpExceptionFilter } from './http/filters/api-http-exception.filter';
import { ApiStandardHttpInterceptor } from './http/interceptors/api-standard-http.interceptor';
import { LobbyHttpModule } from './lobby-http/lobby-http.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [GameModule, SessionModule, LobbyHttpModule],
  controllers: [AppController],
  providers: [
    AppService,
    BearerSessionGuard,
    { provide: APP_INTERCEPTOR, useClass: ApiStandardHttpInterceptor },
    { provide: APP_FILTER, useClass: ApiHttpExceptionFilter },
  ],
})
export class AppModule {}
