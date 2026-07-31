import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const staffAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isStaffAuthenticated()) return router.parseUrl('/admin/login');
  // The change-password screen is the only thing reachable until it's done.
  if (auth.staffMustChangePassword()) return router.parseUrl('/admin/change-password');
  return true;
};

export const clientAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isClientAuthenticated()) return router.parseUrl('/portal/login');
  if (auth.clientMustChangePassword()) return router.parseUrl('/portal/change-password');
  return true;
};

/** Guards the change-password screen itself: must be logged in, but redirect away once the change is already done. */
export const staffMustChangePasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isStaffAuthenticated()) return router.parseUrl('/admin/login');
  if (!auth.staffMustChangePassword()) return router.parseUrl('/admin/dashboard');
  return true;
};

export const clientMustChangePasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isClientAuthenticated()) return router.parseUrl('/portal/login');
  if (!auth.clientMustChangePassword()) return router.parseUrl('/portal/my-tickets');
  return true;
};

export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const emp = auth.currentEmployee();
  if (emp?.roles.includes('Admin')) return true;
  return router.parseUrl('/admin/dashboard');
};
