import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthErrorCode,
  PlayerSessionTokenKind,
  ProcessEnvKey,
} from '@catan/api-interfaces';

interface PlayerJwtPayload {
  readonly kind?: PlayerSessionTokenKind;
  readonly sub?: string;
}

type JwtTtlUnit = 's' | 'm' | 'h' | 'd';
type JwtTtlString = `${number}${JwtTtlUnit}`;
type JwtTtl = number | JwtTtlString;

@Injectable()
export class PlayerSessionJwtService {
  private readonly accessTtl: JwtTtl;
  private readonly refreshTtl: JwtTtl;

  public constructor(private readonly jwt: JwtService) {
    this.accessTtl = this.parseJwtTtl(
      process.env[ProcessEnvKey.PlayerSessionAccessTtl],
      '15m',
    );
    this.refreshTtl = this.parseJwtTtl(
      process.env[ProcessEnvKey.PlayerSessionRefreshTtl],
      '30d',
    );
  }

  public async mintPair(
    sessionId: string,
  ): Promise<{ accessToken: string; refreshToken: string; accessExpiresInSec: number }> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: sessionId,
        kind: PlayerSessionTokenKind.Access,
      },
      { expiresIn: this.accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        sub: sessionId,
        kind: PlayerSessionTokenKind.Refresh,
      },
      { expiresIn: this.refreshTtl },
    );
    return {
      accessToken,
      refreshToken,
      accessExpiresInSec: this.parseTtlToSeconds(this.accessTtl),
    };
  }

  public verifyAccessToken(token: string): string {
    try {
      const p = this.jwt.verify<PlayerJwtPayload>(token);
      if (p['kind'] !== PlayerSessionTokenKind.Access) {
        throw new UnauthorizedException(AuthErrorCode.InvalidAccessToken);
      }
      const sub = typeof p['sub'] === 'string' ? p['sub'] : '';
      if (sub.length === 0) {
        throw new UnauthorizedException(AuthErrorCode.InvalidAccessToken);
      }
      return sub;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException(AuthErrorCode.InvalidAccessToken);
    }
  }

  public verifyRefreshToken(token: string): string {
    try {
      const p = this.jwt.verify<PlayerJwtPayload>(token);
      if (p['kind'] !== PlayerSessionTokenKind.Refresh) {
        throw new UnauthorizedException(AuthErrorCode.InvalidRefreshToken);
      }
      const sub = typeof p['sub'] === 'string' ? p['sub'] : '';
      if (sub.length === 0) {
        throw new UnauthorizedException(AuthErrorCode.InvalidRefreshToken);
      }
      return sub;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException(AuthErrorCode.InvalidRefreshToken);
    }
  }

  private parseJwtTtl(rawValue: string | undefined, fallback: JwtTtlString): JwtTtl {
    if (rawValue === undefined) {
      return fallback;
    }
    const trimmedValue = rawValue.trim();
    if (/^\d+$/.test(trimmedValue)) {
      return Number(trimmedValue);
    }
    if (/^\d+[smhd]$/i.test(trimmedValue)) {
      return trimmedValue.toLowerCase() as JwtTtlString;
    }
    return fallback;
  }

  private parseTtlToSeconds(ttl: JwtTtl): number {
    if (typeof ttl === 'number') {
      return ttl;
    }
    const m = /^(\d+)([smhd])$/i.exec(ttl.trim());
    if (!m) {
      return 900;
    }
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    if (u === 's') {
      return n;
    }
    if (u === 'm') {
      return n * 60;
    }
    if (u === 'h') {
      return n * 3600;
    }
    if (u === 'd') {
      return n * 86400;
    }
    return 900;
  }
}
