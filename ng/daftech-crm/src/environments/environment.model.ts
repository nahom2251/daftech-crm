/**
 * Shape of the runtime environment config. Kept in its own file because
 * `environment.ts` is swapped out by Angular's fileReplacements during
 * production/staging builds — importing the type from there would make the
 * replacement file import itself.
 */
export interface AppEnvironment {
  name: string;
  production: boolean;
  apiBaseUrl: string;
  features: {
    aiNarrativeReports: boolean;
    pdfExport: boolean;
    fileUpload: boolean;
    serviceWorker: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logHttpErrorsToConsole: boolean;
  };
  auth: {
    sessionLifetimeMinutes: number;
    refreshThresholdMinutes: number;
  };
}
