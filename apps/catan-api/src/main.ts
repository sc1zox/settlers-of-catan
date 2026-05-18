import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  ApiGlobalPathPrefix,
  AuthErrorCode,
  parseApiLogLevel,
  ProcessEnvKey,
  SwaggerUiPath,
} from '@catan/api-interfaces';
import { AppModule } from './app/app.module';
import { applyHttpCorsFromEnv } from './app/http/cors-env.util';
import { registerProcessFatalLogging } from './app/infrastructure/logging/register-process-fatal-logging';
import { resolveNestLogLevelsFromEnv } from './app/infrastructure/logging/resolve-nest-log-levels.util';
import { assertPlayerSessionJwtSecretConfigured } from './app/session/session-jwt-secret.util';

function loadDotEnvIfPresent(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

async function bootstrap(): Promise<void> {
  registerProcessFatalLogging();
  loadDotEnvIfPresent();
  assertPlayerSessionJwtSecretConfigured();
  const logLevels = resolveNestLogLevelsFromEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: logLevels });
  app.set('trust proxy', true);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: () => new BadRequestException(AuthErrorCode.InvalidRequest),
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
  const configuredLevel = parseApiLogLevel(process.env[ProcessEnvKey.LogLevel]);
  Logger.log(
    `listening on :${port} (LOG_LEVEL=${configuredLevel ?? 'default'}: ${logLevels.join(',')})`,
  );
  Logger.log(`HTTP API: http://localhost:${port}/${globalPrefix}`);
  Logger.log(`Swagger UI: http://localhost:${port}/${SwaggerUiPath.Docs}`);
}

void bootstrap().catch((error: unknown) => {
  const bootstrapLogger = new Logger('Bootstrap');
  if (error instanceof Error) {
    bootstrapLogger.error('API failed to start', error.stack ?? error.message);
  } else {
    bootstrapLogger.error(`API failed to start: ${String(error)}`);
  }
  process.exit(1);
});
