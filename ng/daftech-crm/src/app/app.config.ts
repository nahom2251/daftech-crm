import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: auth attaches the token and retries 401s, then the
    // error interceptor turns whatever is left into a user-facing message.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // PWA — only registers in production builds, and only once the app
    // has been stable for 30s so the initial load isn't competing with
    // service-worker installation (SRS v2.0 NEW requirement).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
