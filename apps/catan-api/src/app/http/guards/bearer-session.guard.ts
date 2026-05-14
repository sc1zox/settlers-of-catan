import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode } from '@catan/api-interfaces';
import type { Request } from 'express';
import { PlayerSessionJwtService } from '../../session/player-session-jwt.service';

@Injectable()
export class BearerSessionGuard implements CanActivate {
  public constructor(private readonly playerJwt: PlayerSessionJwtService) {}

  public canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.sessionBearerRaw;
    if (!raw || raw.length === 0) {
      throw new UnauthorizedException(AuthErrorCode.MissingBearerSessionToken);
    }
    const sub = this.playerJwt.verifyAccessToken(raw);
    req.sessionToken = sub;
    return true;
  }
}
