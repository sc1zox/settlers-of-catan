import { asActionRejectCode } from './action-reject-resolve.util';
import { ActionRejectCode } from './action-reject-code.enum';
import { AuthErrorCode, HttpErrorCode, InternalApiErrorCode } from './server-contract-code.enum';
import { ClientConnectErrorCode } from './client-connect-error.enum';

export type UserFacingErrorCode =
  | ActionRejectCode
  | AuthErrorCode
  | HttpErrorCode
  | InternalApiErrorCode
  | ClientConnectErrorCode;

export function extractApiErrorCodeFromBody(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') {
    if (typeof body === 'string' && body.trim().length > 0) {
      return body.trim();
    }
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const code = record['code'];
  if (typeof code === 'string' && code.trim().length > 0) {
    return code.trim();
  }
  const message = record['message'];
  if (typeof message === 'string' && message.trim().length > 0) {
    return message.trim();
  }
  return undefined;
}

export function extractApiErrorCodeFromHttpStatus(status: number): string | undefined {
  if (status === 429) {
    return HttpErrorCode.TooManyRequests;
  }
  if (status === 401) {
    return AuthErrorCode.InvalidAccessToken;
  }
  if (status >= 500) {
    return InternalApiErrorCode.Unexpected;
  }
  return undefined;
}

export function normalizeUserFacingErrorCode(raw: string): UserFacingErrorCode | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const authValues = Object.values(AuthErrorCode) as string[];
  for (let i = 0; i < authValues.length; i += 1) {
    if (authValues[i] === trimmed) {
      return trimmed as AuthErrorCode;
    }
  }
  const httpValues = Object.values(HttpErrorCode) as string[];
  for (let i = 0; i < httpValues.length; i += 1) {
    if (httpValues[i] === trimmed) {
      return trimmed as HttpErrorCode;
    }
  }
  const connectValues = Object.values(ClientConnectErrorCode) as string[];
  for (let i = 0; i < connectValues.length; i += 1) {
    if (connectValues[i] === trimmed) {
      return trimmed as ClientConnectErrorCode;
    }
  }
  if (trimmed === InternalApiErrorCode.Unexpected) {
    return InternalApiErrorCode.Unexpected;
  }
  const rejectCode = asActionRejectCode(trimmed);
  if (rejectCode !== ActionRejectCode.Unknown || trimmed === ActionRejectCode.Unknown) {
    return rejectCode;
  }
  return undefined;
}
