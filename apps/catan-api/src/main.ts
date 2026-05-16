import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ApiGlobalPathPrefix, ProcessEnvKey, SwaggerUiPath } from '@catan/api-interfaces';
import { AppModule } from './app/app.module';
import { applyHttpCorsFromEnv } from './app/http/cors-env.util';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  applyHttpCorsFromEnv(app);
  app.useWebSocketAdapter(new IoAdapter(app));
  const globalPrefix = ApiGlobalPathPrefix.Rest;
  app.setGlobalPrefix(globalPrefix);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Settlers of Catan API')
    .setDescription('HTTP surface and multiplayer session contracts for the Catan workspace.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SwaggerUiPath.Docs, app, document);
  const port = Number(process.env[ProcessEnvKey.Port]) || 3000;
  await app.listen(port);
  Logger.log(`HTTP API: http://localhost:${port}/${globalPrefix}`);
  Logger.log(`Swagger UI: http://localhost:${port}/${SwaggerUiPath.Docs}`);
}

void bootstrap();
