import { Injectable, NestMiddleware } from '@nestjs/common';
import { HttpHeaderName, parseAuthorizationBearer } from '@catan/api-interfaces';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class BearerExtractMiddleware implements NestMiddleware {
  public use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.get(HttpHeaderName.Authorization);
    const bearer = parseAuthorizationBearer(authHeader ?? '');
    if (bearer !== undefined) {
      req.sessionBearerRaw = bearer;
    }
    next();
  }
}
