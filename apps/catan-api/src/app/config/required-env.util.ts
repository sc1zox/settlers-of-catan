import { ProcessEnvKey } from '@catan/api-interfaces';

export function requireEnvString(key: ProcessEnvKey, minLength = 1): string {
  const raw = process.env[key]?.trim();
  if (raw === undefined || raw.length === 0) {
    throw new Error(`${key} must be set in the environment (e.g. .env)`);
  }
  if (raw.length < minLength) {
    throw new Error(`${key} must be at least ${minLength} characters`);
  }
  return raw;
}

export function optionalEnvString(key: ProcessEnvKey, defaultValue: string): string {
  const raw = process.env[key]?.trim();
  if (raw === undefined || raw.length === 0) {
    return defaultValue;
  }
  return raw;
}
