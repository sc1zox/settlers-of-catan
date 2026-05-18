import { LogLevel } from '@nestjs/common';
import { ApiLogLevel, parseApiLogLevel, ProcessEnvKey } from '@catan/api-interfaces';

const DEFAULT_LEVELS: LogLevel[] = ['error', 'warn', 'log'];

export function resolveNestLogLevelsFromEnv(): LogLevel[] {
  const configured = parseApiLogLevel(process.env[ProcessEnvKey.LogLevel]);
  if (configured === undefined) {
    return DEFAULT_LEVELS;
  }
  switch (configured) {
    case ApiLogLevel.Error:
      return ['error'];
    case ApiLogLevel.Warn:
      return ['error', 'warn'];
    case ApiLogLevel.Log:
      return DEFAULT_LEVELS;
    case ApiLogLevel.Debug:
      return ['error', 'warn', 'log', 'debug'];
    case ApiLogLevel.Verbose:
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    default:
      return DEFAULT_LEVELS;
  }
}
