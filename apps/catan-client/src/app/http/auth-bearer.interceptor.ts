import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionTokenService } from './session-token.service';

export const authBearerInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(SessionTokenService);
  const t = tokens.token();
  if (t.length > 0 && !req.headers.has('Authorization')) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }));
  }
  return next(req);
};
