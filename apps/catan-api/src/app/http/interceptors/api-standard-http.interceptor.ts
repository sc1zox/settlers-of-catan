import {
  ApiEnvelopeFieldKey,
  HttpHeaderName,
  parseAuthorizationBearer,
} from '@catan/api-interfaces';
import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs';

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
    res.setHeader(HttpHeaderName.XRequestId, requestId);

    const authHeader = req.get(HttpHeaderName.Authorization);
    const bearer = parseAuthorizationBearer(authHeader ?? '');
    if (bearer !== undefined) {
      req.sessionToken = bearer;
    }

    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === 'object' &&
          ApiEnvelopeFieldKey.Data in payload &&
          ApiEnvelopeFieldKey.RequestId in payload
        ) {
          return payload;
        }
        return {
          [ApiEnvelopeFieldKey.Data]: payload,
          [ApiEnvelopeFieldKey.RequestId]: requestId,
        };
      }),
    );
  }
}
