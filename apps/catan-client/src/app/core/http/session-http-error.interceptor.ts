import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { formatBearerAuthorizationHeader, HttpHeaderName } from '@catan/api-interfaces';
import { SessionHttpAction, SessionRestPath } from '../../../shared/client-constants';
import { catchError, switchMap, throwError } from 'rxjs';
import { PlayerSessionService } from '../session/player-session.service';
import { SESSION_AUTH_RETRY } from '../../../shared/http/session-http-context';

function isSessionPublicUrl(url: string): boolean {
  return (
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Bootstrap}`) ||
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Refresh}`)
  );
}

export const sessionHttpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const sessions = inject(PlayerSessionService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      if (err.status === 429) {
        sessions.recordHttpFailure(err);
        return throwError(() => err);
      }
      if (err.status !== 401) {
        return throwError(() => err);
      }
      if (req.context.get(SESSION_AUTH_RETRY)) {
        sessions.clear();
        return throwError(() => err);
      }
      if (isSessionPublicUrl(req.url)) {
        return throwError(() => err);
      }
      return sessions.tryRefresh().pipe(
        switchMap((ok) => {
          if (!ok) {
            sessions.clear();
            return throwError(() => err);
          }
          const access = sessions.accessToken();
          if (access.length === 0) {
            sessions.clear();
            return throwError(() => err);
          }
          const retry = req.clone({
            context: req.context.set(SESSION_AUTH_RETRY, true),
            setHeaders: {
              [HttpHeaderName.Authorization]: formatBearerAuthorizationHeader(access),
            },
          });
          return next(retry).pipe(
            catchError((e: unknown) => {
              sessions.clear();
              return throwError(() => e);
            }),
          );
        }),
      );
    }),
  );
};
