import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

export const apiEnvelopeInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body !== null && typeof event.body === 'object') {
        const body = event.body as Record<string, unknown>;
        if ('data' in body && 'requestId' in body) {
          return event.clone({ body: body['data'] });
        }
      }
      return event;
    }),
  );
};
