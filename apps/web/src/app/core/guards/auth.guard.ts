import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Keeps the authenticated shell behind a token. Previously every screen
 * rendered for signed-out visitors and only failed once its API calls 401'd.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (localStorage.getItem('token')) return true;

  router.navigate(['/login']);
  return false;
};
