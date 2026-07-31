import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';

/** Turns raw HTTP failures into a single readable message and a user-visible toast. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      const message = describe(error);

      if (environment.logging.logHttpErrorsToConsole) {
        console.error(`[HTTP ${error.status}] ${req.method} ${req.url}`, error.error);
      }

      // 401 is handled by the auth interceptor (refresh / redirect) — don't double-report it.
      if (error.status !== 401) toast.error(message);

      return throwError(() => new Error(message));
    })
  );
};

function describe(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Cannot reach the server. Check your connection and try again.';
  if (error.status === 403) return 'You do not have permission to do that.';
  if (error.status === 404) return 'The requested item was not found.';
  if (error.status === 429) {
    const retryAfter = error.headers?.get('Retry-After');
    return retryAfter
      ? `Too many requests. Please wait ${retryAfter} seconds and try again.`
      : 'Too many requests. Please slow down and try again shortly.';
  }
  if (error.status >= 500) return 'The server hit an unexpected problem. Please try again.';

  const body = error.error;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: string; title?: string; message?: string });
    return detail.detail ?? detail.message ?? detail.title ?? error.message;
  }
  return error.message;
}
