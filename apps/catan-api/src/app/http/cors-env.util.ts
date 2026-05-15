import type { INestApplication } from '@nestjs/common';

export type SocketIoCorsSetting =
  | false
  | {
      readonly origin: boolean | readonly string[];
      readonly credentials: boolean;
    };

const PERMISSIVE_CORS: Exclude<SocketIoCorsSetting, false> = {
  origin: true,
  credentials: true,
};

export function resolveSocketIoCors(): SocketIoCorsSetting {
  return PERMISSIVE_CORS;
}

export function applyHttpCorsFromEnv(app: INestApplication): void {
  app.enableCors({ origin: PERMISSIVE_CORS.origin, credentials: PERMISSIVE_CORS.credentials });
}
