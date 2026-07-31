import { Routes } from '@angular/router';
import {
  staffAuthGuard, clientAuthGuard, adminRoleGuard,
  staffMustChangePasswordGuard, clientMustChangePasswordGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin/login' },

  // Admin / Staff app
  {
    path: 'admin/login',
    loadComponent: () => import('./staff/login/staff-login.component').then(m => m.StaffLoginComponent),
  },
  {
    path: 'admin/change-password',
    canActivate: [staffMustChangePasswordGuard],
    loadComponent: () => import('./staff/change-password/staff-change-password.component').then(m => m.StaffChangePasswordComponent),
  },
  {
    path: 'admin',
    canActivate: [staffAuthGuard],
    loadComponent: () => import('./staff/shell/staff-shell.component').then(m => m.StaffShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./staff/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'clients', loadComponent: () => import('./staff/clients/clients-list.component').then(m => m.ClientsListComponent) },
      { path: 'clients/:id', loadComponent: () => import('./staff/clients/client-detail.component').then(m => m.ClientDetailComponent) },
      {
        path: 'signup-requests',
        canActivate: [adminRoleGuard],
        loadComponent: () => import('./staff/signup-requests/signup-requests.component').then(m => m.SignupRequestsComponent),
      },
      { path: 'agreements', loadComponent: () => import('./staff/agreements/agreements.component').then(m => m.AgreementsComponent) },
      { path: 'tickets', loadComponent: () => import('./staff/tickets/tickets.component').then(m => m.TicketsComponent) },
      {
        path: 'employees',
        canActivate: [adminRoleGuard],
        loadComponent: () => import('./staff/employees/employees.component').then(m => m.EmployeesComponent),
      },
      { path: 'time-tracking', loadComponent: () => import('./staff/time-tracking/time-tracking.component').then(m => m.TimeTrackingComponent) },
      { path: 'employee-performance', loadComponent: () => import('./staff/employee-performance/employee-performance.component').then(m => m.EmployeePerformanceComponent) },
      { path: 'maintenance', loadComponent: () => import('./staff/maintenance/maintenance.component').then(m => m.MaintenanceComponent) },
      { path: 'notifications', loadComponent: () => import('./staff/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'reports', loadComponent: () => import('./staff/reports/reports.component').then(m => m.ReportsComponent) },
      {
        path: 'session-activity',
        canActivate: [adminRoleGuard],
        loadComponent: () => import('./staff/session-activity/session-activity.component').then(m => m.SessionActivityComponent),
      },
    ],
  },

  // Client Portal
  {
    path: 'portal/login',
    loadComponent: () => import('./portal/login/portal-login.component').then(m => m.PortalLoginComponent),
  },
  {
    path: 'portal/change-password',
    canActivate: [clientMustChangePasswordGuard],
    loadComponent: () => import('./portal/change-password/portal-change-password.component').then(m => m.PortalChangePasswordComponent),
  },
  {
    path: 'portal/signup',
    loadComponent: () => import('./portal/signup/portal-signup.component').then(m => m.PortalSignupComponent),
  },
  {
    path: 'portal',
    canActivate: [clientAuthGuard],
    loadComponent: () => import('./portal/shell/portal-shell.component').then(m => m.PortalShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'my-tickets' },
      { path: 'submit-issue', loadComponent: () => import('./portal/submit-issue/submit-issue.component').then(m => m.SubmitIssueComponent) },
      { path: 'confirm-resolution', loadComponent: () => import('./portal/confirm-resolution/confirm-resolution.component').then(m => m.ConfirmResolutionComponent) },
      { path: 'survey/:ticketId', loadComponent: () => import('./portal/satisfaction-survey/satisfaction-survey.component').then(m => m.SatisfactionSurveyComponent) },
      { path: 'my-tickets', loadComponent: () => import('./portal/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent) },
      { path: 'notifications', loadComponent: () => import('./portal/notifications/portal-notifications.component').then(m => m.PortalNotificationsComponent) },
    ],
  },

  { path: '**', redirectTo: 'admin/login' },
];
