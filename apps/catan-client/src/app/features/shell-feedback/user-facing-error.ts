import { HttpErrorResponse } from '@angular/common/http';
import {
  ActionRejectCode,
  AuthErrorCode,
  ClientConnectErrorCode,
  extractApiErrorCodeFromBody,
  extractApiErrorCodeFromHttpStatus,
  HttpErrorCode,
  InternalApiErrorCode,
  normalizeUserFacingErrorCode,
  UserFacingErrorCode,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { actionRejectMessageFromCode } from './action-reject';

const SHELL_ERROR_KEY: Partial<Record<UserFacingErrorCode, string>> = {
  [AuthErrorCode.MissingBearerSessionToken]: 'shell.errorNotSignedIn',
  [AuthErrorCode.InvalidAccessToken]: 'shell.errorSessionExpired',
  [AuthErrorCode.InvalidRefreshToken]: 'shell.errorSessionExpired',
  [AuthErrorCode.InvalidRequest]: 'shell.errorInvalidRequest',
  [HttpErrorCode.TooManyRequests]: 'shell.errorTooManyRequests',
  [InternalApiErrorCode.Unexpected]: 'shell.errorUnexpected',
  [ClientConnectErrorCode.PlayerSessionNotReady]: 'shell.errorSessionNotReady',
  [ClientConnectErrorCode.SocketConnectTimeout]: 'shell.errorSocketTimeout',
  [ClientConnectErrorCode.SocketHandshakeRejected]: 'shell.errorSocketRejected',
};

export function parseUserFacingErrorCode(err: unknown): UserFacingErrorCode | undefined {
  if (err instanceof HttpErrorResponse) {
    const fromBody = extractApiErrorCodeFromBody(err.error);
    if (fromBody !== undefined) {
      const normalized = normalizeUserFacingErrorCode(fromBody);
      if (normalized !== undefined) {
        return normalized;
      }
    }
    const fromStatus = extractApiErrorCodeFromHttpStatus(err.status);
    if (fromStatus !== undefined) {
      return normalizeUserFacingErrorCode(fromStatus);
    }
    return undefined;
  }
  if (err instanceof Error) {
    return normalizeUserFacingErrorCode(err.message);
  }
  if (typeof err === 'string') {
    return normalizeUserFacingErrorCode(err);
  }
  return undefined;
}

export function userFacingErrorMessageFromCode(
  translate: TranslateService,
  code: UserFacingErrorCode,
): string {
  const shellKey = SHELL_ERROR_KEY[code];
  if (shellKey !== undefined) {
    return translate.instant(marker(shellKey));
  }
  return actionRejectMessageFromCode(translate, code as ActionRejectCode);
}

export function resolveUserFacingErrorMessage(
  translate: TranslateService,
  err: unknown,
  fallbackMarker: string,
  fallbackParams?: Record<string, string>,
): string {
  const code = parseUserFacingErrorCode(err);
  if (code !== undefined) {
    return userFacingErrorMessageFromCode(translate, code);
  }
  return translate.instant(marker(fallbackMarker), fallbackParams);
}
