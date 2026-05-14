import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  formatBearerAuthorizationHeader,
  HttpHeaderName,
  SessionHttpAction,
  SessionRestPath,
} from '@catan/api-interfaces';
import { PlayerSessionService } from './player-session.service';

function isSessionPublicUrl(url: string): boolean {
  return (
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Bootstrap}`) ||
    url.includes(`/${SessionRestPath.Prefix}/${SessionHttpAction.Refresh}`)
  );
}

export const sessionBearerInterceptor: HttpInterceptorFn = (req, next) => {
  const sessions = inject(PlayerSessionService);
  if (isSessionPublicUrl(req.url)) {
    return next(req);
  }
  const access = sessions.accessToken();
  if (access.length > 0 && !req.headers.has(HttpHeaderName.Authorization)) {
    return next(
      req.clone({
        setHeaders: {
          [HttpHeaderName.Authorization]: formatBearerAuthorizationHeader(access),
        },
      }),
    );
  }
  return next(req);
};
