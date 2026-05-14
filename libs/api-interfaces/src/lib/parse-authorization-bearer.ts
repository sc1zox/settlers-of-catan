import { HttpAuthScheme } from './http-auth.enum';

const BEARER_PREFIX = `${HttpAuthScheme.Bearer} `;

export function formatBearerAuthorizationHeader(token: string): string {
  return `${HttpAuthScheme.Bearer} ${token}`;
}

export function parseAuthorizationBearer(headerValue: string): string | undefined {
  if (!headerValue.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = headerValue.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

export function parseAuthorizationBearerFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return parseAuthorizationBearer(value);
}
