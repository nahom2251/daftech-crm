import type { AppEnvironment } from './environment.model';

/**
 * Production. `apiBaseUrl` is rewritten at build time by scripts/set-api-url.mjs
 * from the API_BASE_URL environment variable (required when the API is deployed on
 * a different host than the frontend, e.g. Render). The committed default assumes a
 * reverse proxy that serves the API on the same origin under /api.
 */
export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  apiBaseUrl: '/api',
  features: {
    aiNarrativeReports: true,
    pdfExport: true,
    fileUpload: true,
    serviceWorker: true,
  },
  logging: {
    level: 'warn',
    logHttpErrorsToConsole: false,
  },
  auth: {
    sessionLifetimeMinutes: 240,
    refreshThresholdMinutes: 10,
  },
};
