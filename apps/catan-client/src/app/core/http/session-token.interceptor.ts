import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { formatBearerAuthorizationHeader, HttpHeaderName } from '@catan/api-interfaces';
import { SessionHttpAction, SessionRestPath } from '../../../shared/client-constants';
import { from, switchMap } from 'rxjs';
import { PlayerSessionService } from '../session/player-session.service';

function isSessionPublicUrl(url: string): boolean {
  return (
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Bootstrap}`) ||
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Refresh}`)
  );
}

function attachBearer<T>(req: HttpRequest<T>, access: string): HttpRequest<T> {
  return req.clone({
    setHeaders: {
      [HttpHeaderName.Authorization]: formatBearerAuthorizationHeader(access),
    },
  });
}

export const sessionBearerInterceptor: HttpInterceptorFn = (req, next) => {
  const sessions = inject(PlayerSessionService);
  if (isSessionPublicUrl(req.url) || req.headers.has(HttpHeaderName.Authorization)) {
    return next(req);
  }
  const access = sessions.accessToken();
  if (access.length > 0) {
    return next(attachBearer(req, access));
  }
  // Token not in memory yet (e.g. probe firing during a page-reload race with
  // hydrate). Wait for ensureReady to populate it before firing — otherwise
  // the request goes out anonymous and the server replies 401.
  return from(sessions.ensureReady()).pipe(
    switchMap(() => {
      const refreshed = sessions.accessToken();
      if (refreshed.length === 0) {
        return next(req);
      }
      return next(attachBearer(req, refreshed));
    }),
  );
};
