import { SessionCookieName } from '@catan/api-interfaces';
import type { CookieOptions, Response } from 'express';

const REFRESH_COOKIE_PATH = '/api/session';

export function refreshTokenCookieOptions(refreshTtlSec: number): CookieOptions {
  const isProduction = process.env['NODE_ENV']?.trim().toLowerCase() === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlSec * 1000,
  };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string, refreshTtlSec: number): void {
  res.cookie(SessionCookieName.RefreshToken, refreshToken, refreshTokenCookieOptions(refreshTtlSec));
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(SessionCookieName.RefreshToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV']?.trim().toLowerCase() === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}

export function readRefreshTokenFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return undefined;
  }
  const target = `${SessionCookieName.RefreshToken}=`;
  const parts = cookieHeader.split(';');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i].trim();
    if (part.startsWith(target)) {
      const value = part.slice(target.length).trim();
      return value.length > 0 ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}
