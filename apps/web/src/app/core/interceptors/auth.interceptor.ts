import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Attaches the stored JWT to outgoing API calls.
 *
 * Until now the token was saved at login and never sent, so every protected
 * route had to identify the caller some other way. Anything mounted behind
 * `authenticate` middleware depends on this.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  // The auth endpoints mint the token — they must not require one, and a 401
  // from them is a bad password, not an expired session.
  const isAuthCall = req.url.includes('/auth/');

  const request = token && !isAuthCall
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthCall) {
        localStorage.clear();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
