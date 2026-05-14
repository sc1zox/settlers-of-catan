import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode } from '@catan/api-interfaces';
import type { Request } from 'express';

export const SessionToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const token = ctx.switchToHttp().getRequest<Request>().sessionToken;
    if (!token || token.length === 0) {
      throw new UnauthorizedException(AuthErrorCode.MissingBearerSessionToken);
    }
    return token;
  },
);
