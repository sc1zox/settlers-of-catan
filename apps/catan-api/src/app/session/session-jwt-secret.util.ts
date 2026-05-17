import { ProcessEnvKey } from '@catan/api-interfaces';
import { requireEnvString } from '../config/required-env.util';

const MIN_PLAYER_SESSION_JWT_SECRET_LENGTH = 32;

export function resolvePlayerSessionJwtSecret(): string {
  return requireEnvString(ProcessEnvKey.PlayerSessionJwtSecret, MIN_PLAYER_SESSION_JWT_SECRET_LENGTH);
}

export function assertPlayerSessionJwtSecretConfigured(): void {
  resolvePlayerSessionJwtSecret();
}
