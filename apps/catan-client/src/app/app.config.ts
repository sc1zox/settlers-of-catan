import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiEnvelopeInterceptor } from './http/api-envelope.interceptor';
import { sessionBearerInterceptor } from './http/session-token.interceptor';
import { sessionHttpErrorInterceptor } from './http/session-http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([
        sessionBearerInterceptor,
        apiEnvelopeInterceptor,
        sessionHttpErrorInterceptor,
      ]),
    ),
  ],
};
