import type { INestApplication } from '@nestjs/common';
import { ProcessEnvKey } from '@catan/api-interfaces';

export type SocketIoCorsSetting =
  | false
  | {
      readonly origin: boolean | readonly string[];
      readonly credentials: boolean;
    };

function parseCorsOriginsFromEnv(): readonly string[] | null {
  const raw = process.env[ProcessEnvKey.CorsOrigins]?.trim();
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parts = raw.split(',');
  const origins: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const origin = parts[i].trim();
    if (origin.length > 0) {
      origins.push(origin);
    }
  }
  if (origins.length === 0) {
    return null;
  }
  return origins;
}

export function resolveSocketIoCors(): SocketIoCorsSetting {
  const origins = parseCorsOriginsFromEnv();
  if (origins === null) {
    return {
      origin: true,
      credentials: true,
    };
  }
  return {
    origin: origins as readonly string[],
    credentials: true,
  };
}

export function applyHttpCorsFromEnv(app: INestApplication): void {
  const setting = resolveSocketIoCors();
  if (setting === false) {
    return;
  }
  app.enableCors({ origin: setting.origin, credentials: setting.credentials });
}
