import type { AppEnvironment } from './environment.model';

/** Staging: production build settings, verbose logging, all features on for QA. */
export const environment: AppEnvironment = {
  name: 'staging',
  production: true,
  apiBaseUrl: 'https://staging-api.crm.daftech.et/api',
  features: {
    aiNarrativeReports: true,
    pdfExport: true,
    fileUpload: true,
    serviceWorker: true,
  },
  logging: {
    level: 'info',
    logHttpErrorsToConsole: true,
  },
  auth: {
    sessionLifetimeMinutes: 480,
    refreshThresholdMinutes: 10,
  },
};
