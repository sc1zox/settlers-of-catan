import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiEnvelopeInterceptor } from './http/api-envelope.interceptor';
import {
  sessionTokenInterceptor,
  sessionTokenUnauthorizedInterceptor,
} from './http/session-token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([
        sessionTokenInterceptor,
        apiEnvelopeInterceptor,
        sessionTokenUnauthorizedInterceptor,
      ]),
    ),
  ],
};
