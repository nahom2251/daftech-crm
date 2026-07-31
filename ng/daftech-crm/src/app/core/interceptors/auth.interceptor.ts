import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints that must never carry a token or trigger a refresh loop. */
const PUBLIC_PATHS = ['/auth/employee-login', '/auth/client-login', '/auth/refresh', '/clients/signup'];

const isPublic = (req: HttpRequest<unknown>) => PUBLIC_PATHS.some(path => req.url.includes(path));

/**
 * Attaches the bearer token to every API call and recovers from 401s by
 * refreshing once. Because AuthService.refreshToken() shares a single in-flight
 * promise, parallel requests that all 401 queue behind the same refresh instead
 * of stampeding the server. If refresh fails, the session is cleared and the
 * user is sent to the matching login screen.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  const authorized = isPublic(req) ? req : withToken(req, auth.accessToken);

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isPublic(req)) {
        return throwError(() => error);
      }

      const wasClient = auth.currentClient() !== null;

      return from(auth.refreshToken()).pipe(
        switchMap(token => {
          if (token) return next(withToken(req, token));

          auth.clear();
          void router.navigate([wasClient ? '/portal/login' : '/admin/login'], {
            queryParams: { reason: 'session-expired' },
          });
          return throwError(() => error);
        })
      );
    })
  );
};
