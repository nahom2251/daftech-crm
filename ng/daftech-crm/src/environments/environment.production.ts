import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  apiBaseUrl: 'https://daftech-crm-api2.onrender.com/api',
  features: {
    aiNarrativeReports: true,
    pdfExport: true,
    fileUpload: true,
    serviceWorker: false,
  },
  logging: {
    level: 'error',
    logHttpErrorsToConsole: false,
  },
  auth: {
    sessionLifetimeMinutes: 480,
    refreshThresholdMinutes: 10,
  },
};