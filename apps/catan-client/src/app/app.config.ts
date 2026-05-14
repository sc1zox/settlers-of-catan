import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiEnvelopeInterceptor } from './http/api-envelope.interceptor';
import { authBearerInterceptor } from './http/auth-bearer.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authBearerInterceptor, apiEnvelopeInterceptor])),
  ],
};
