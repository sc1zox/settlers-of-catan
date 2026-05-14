import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = Number(process.env['PORT']) || 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

void bootstrap();
