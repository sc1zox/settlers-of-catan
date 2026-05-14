import type { INestApplication } from '@nestjs/common';
import { ProcessEnvKey } from '@catan/api-interfaces';

export type SocketIoCorsSetting =
  | false
  | {
      readonly origin: boolean | readonly string[];
      readonly credentials: boolean;
    };

function readNodeEnv(): string {
  return process.env[ProcessEnvKey.NodeEnv]?.trim() ?? 'development';
}

function readCorsOriginsRaw(): string {
  return process.env[ProcessEnvKey.CorsOrigins]?.trim() ?? '';
}

function parseOriginList(raw: string): readonly string[] {
  const parts = raw.split(',');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const v = parts[i].trim();
    if (v.length > 0) {
      out.push(v);
    }
  }
  return out;
}

export function resolveSocketIoCors(): SocketIoCorsSetting {
  const nodeEnv = readNodeEnv();
  const raw = readCorsOriginsRaw();
  if (raw === 'false' || raw === '0') {
    return false;
  }
  if (nodeEnv === 'production') {
    if (raw.length === 0) {
      return false;
    }
    if (raw === '*') {
      return { origin: true, credentials: true };
    }
    const list = parseOriginList(raw);
    if (list.length === 0) {
      return false;
    }
    return { origin: list, credentials: true };
  }
  if (raw.length === 0 || raw === '*') {
    return { origin: true, credentials: true };
  }
  const list = parseOriginList(raw);
  if (list.length === 0) {
    return { origin: true, credentials: true };
  }
  return { origin: list, credentials: true };
}

export function applyHttpCorsFromEnv(app: INestApplication): void {
  const nodeEnv = readNodeEnv();
  const raw = readCorsOriginsRaw();
  if (raw === 'false' || raw === '0') {
    return;
  }
  if (nodeEnv === 'production') {
    if (raw.length === 0) {
      return;
    }
    if (raw === '*') {
      app.enableCors({ origin: true, credentials: true });
      return;
    }
    const list = parseOriginList(raw);
    if (list.length === 0) {
      return;
    }
    app.enableCors({ origin: [...list], credentials: true });
    return;
  }
  if (raw.length === 0 || raw === '*') {
    app.enableCors({ origin: true, credentials: true });
    return;
  }
  const list = parseOriginList(raw);
  if (list.length === 0) {
    app.enableCors({ origin: true, credentials: true });
    return;
  }
  app.enableCors({ origin: [...list], credentials: true });
}
