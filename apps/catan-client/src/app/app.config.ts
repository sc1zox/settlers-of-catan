import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { TRANSLATE_HTTP_LOADER_CONFIG, TranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';
import { AppInitService } from './core/bootstrap/app-init.service';
import { apiEnvelopeInterceptor } from './core/http/api-envelope.interceptor';
import { sessionBearerInterceptor } from './core/http/session-token.interceptor';
import { sessionHttpErrorInterceptor } from './core/http/session-http-error.interceptor';
import { registerTranslationMarkers } from '../shared/i18n/register-translation-markers';

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
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: { prefix: './assets/i18n/', suffix: '.json' },
    },
    ...provideTranslateService({
      fallbackLang: 'de',
      lang: 'de',
      loader: provideTranslateLoader(TranslateHttpLoader),
    }),
    provideAppInitializer(() => {
      registerTranslationMarkers();
      const translate = inject(TranslateService);
      return firstValueFrom(translate.use('de'));
    }),
    provideAppInitializer(() => inject(AppInitService).initialize()),
  ],
};
