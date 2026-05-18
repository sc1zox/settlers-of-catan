export enum ApiLogLevel {
  Error = 'error',
  Warn = 'warn',
  Log = 'log',
  Debug = 'debug',
  Verbose = 'verbose',
}

export function parseApiLogLevel(raw: string | undefined): ApiLogLevel | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  const values = Object.values(ApiLogLevel) as string[];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === normalized) {
      return normalized as ApiLogLevel;
    }
  }
  return undefined;
}
