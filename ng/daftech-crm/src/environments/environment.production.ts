import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  apiBaseUrl: 'https://daftech-crm-api.onrender.com/api', // ← Backend URL
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