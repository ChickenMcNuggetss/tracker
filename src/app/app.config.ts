import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { db, type ThemeMode } from './core/db/tracker-db';

const applyThemePreference = (theme: ThemeMode): void => {
  const body = document.body;
  const nextTheme = theme === 'dark' ? 'dark' : 'light';

  body.dataset['theme'] = nextTheme;
  body.classList.toggle('theme-dark', nextTheme === 'dark');
  body.classList.toggle('theme-light', nextTheme === 'light');
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);

      return db.profileSettings.get('default').then((settings) => {
        const lang = settings?.language ?? 'en';
        const theme = settings?.theme ?? 'dark';

        translate.use(lang);
        applyThemePreference(theme);
      });
    }),
  ],
};
