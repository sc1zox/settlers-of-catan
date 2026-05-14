import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode } from '@catan/api-interfaces';
import type { Request } from 'express';

@Injectable()
export class BearerSessionGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.sessionToken || req.sessionToken.length === 0) {
      throw new UnauthorizedException(AuthErrorCode.MissingBearerSessionToken);
    }
    return true;
  }
}
