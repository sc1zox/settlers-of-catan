import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs';
import { tryParseBearerFromHeader } from '../bearer-parse.util';

@Injectable()
export class ApiStandardHttpInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const authHeader = req.get('Authorization');
    const bearer = tryParseBearerFromHeader(authHeader ?? '');
    if (bearer !== undefined) {
      req.sessionToken = bearer;
    }

    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in payload &&
          'requestId' in payload
        ) {
          return payload;
        }
        return {
          data: payload,
          requestId,
        };
      }),
    );
  }
}
