import type { AppEnvironment } from './environment.model';

/** Local development environment. */
export const environment: AppEnvironment = {
  name: 'development',
  production: false,
  apiBaseUrl: 'https://localhost:7001/api',
  /** Feature flags — keep UI branches out of build-time conditionals. */
  features: {
    aiNarrativeReports: true,
    pdfExport: true,
    fileUpload: true,
    serviceWorker: false,
  },
  logging: {
    level: 'debug',
    logHttpErrorsToConsole: true,
  },
  auth: {
    /** Idle/absolute session lifetime in minutes before the client forces a re-login. */
    sessionLifetimeMinutes: 480,
    /** Refresh the session token when fewer than this many minutes remain. */
    refreshThresholdMinutes: 10,
  },
};
export type { AppEnvironment } from './environment.model';
