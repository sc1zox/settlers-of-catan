import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { SessionTokenService } from './session-token.service';

export const sessionTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(SessionTokenService);
  const t = tokens.token();
  if (t.length > 0 && !req.headers.has('Authorization')) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }));
  }
  return next(req);
};

export const sessionTokenUnauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(SessionTokenService);
  return next(req).pipe(
    tap({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          tokens.clear();
        }
      },
    }),
  );
};
