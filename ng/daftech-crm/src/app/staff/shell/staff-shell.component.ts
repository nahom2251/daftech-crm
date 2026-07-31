import { Component, computed, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmployeeRole, NotificationRecipientType } from '../../core/models';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  rolesAllowed?: EmployeeRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
  { label: 'Clients', path: '/admin/clients', icon: '🏢' },
  { label: 'Signup Requests', path: '/admin/signup-requests', icon: '📥', rolesAllowed: ['Admin'] },
  { label: 'Agreements', path: '/admin/agreements', icon: '📄' },
  { label: 'Tickets', path: '/admin/tickets', icon: '🎫' },
  { label: 'Employees', path: '/admin/employees', icon: '👥', rolesAllowed: ['Admin'] },
  { label: 'Time Tracking', path: '/admin/time-tracking', icon: '⏱️' },
  { label: 'Employee Performance', path: '/admin/employee-performance', icon: '📈' },
  { label: 'Maintenance History', path: '/admin/maintenance', icon: '🛠️' },
  { label: 'Notifications', path: '/admin/notifications', icon: '🔔' },
  { label: 'Reports', path: '/admin/reports', icon: '📈' },
  { label: 'Session Activity', path: '/admin/session-activity', icon: '🟢', rolesAllowed: ['Admin'] },
];

@Component({
  selector: 'app-staff-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="assets/daftech-logo.png" alt="DAFTECH" class="brand-logo-img brand-logo-sm" />
          <div>
            <div class="brand-name">DAFTECH</div>
            <div class="brand-sub">Admin / Staff</div>
          </div>
        </div>
        <nav>
          @for (item of visibleNavItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-link">
              <span class="nav-icon">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidebar-footer">
          <div class="who">
            <div class="who-name">{{ auth.currentEmployee()?.fullName }}</div>
            <div class="who-role">{{ auth.currentEmployee()?.roles?.join(', ') }}</div>
          </div>
          <button class="btn btn-outline btn-sm" (click)="logout()">Log out</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div></div>
          <a routerLink="/admin/notifications" class="bell">
            🔔
            @if (unread() > 0) {
              <span class="bell-count">{{ unread() }}</span>
            }
          </a>
        </header>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; }
    .sidebar {
      width: 240px; flex-shrink: 0; background: var(--navy-950); color: #fff;
      display: flex; flex-direction: column; padding: 1.1rem 0.9rem;
      position: sticky; top: 0; height: 100vh;
    }
    .brand { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.4rem 1.2rem; }
    .brand .brand-logo-img { background: #fff; border-radius: 8px; padding: 3px; }
    .brand-name { font-weight: 700; font-size: 0.95rem; color: #fff; }
    .brand-sub { font-size: 0.7rem; color: var(--slate-400); }
    nav { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
    .nav-link {
      display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.7rem; border-radius: 8px;
      color: var(--slate-300); font-size: 0.87rem; font-weight: 500;
    }
    .nav-link:hover { background: var(--navy-800); color: #fff; }
    .nav-link.active { background: var(--accent); color: #fff; }
    .nav-icon { font-size: 0.95rem; width: 1.2rem; text-align: center; }
    .sidebar-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      padding-top: 0.9rem; border-top: 1px solid var(--navy-700);
    }
    .who-name { font-size: 0.82rem; font-weight: 600; color: #fff; }
    .who-role { font-size: 0.7rem; color: var(--slate-400); }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      height: 56px; flex-shrink: 0; background: #fff; border-bottom: 1px solid var(--slate-200);
      display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem;
    }
    .bell { position: relative; font-size: 1.15rem; }
    .bell-count {
      position: absolute; top: -6px; right: -8px; background: var(--red); color: #fff;
      font-size: 0.65rem; font-weight: 700; border-radius: 999px; padding: 0.05rem 0.35rem;
    }
    .content { padding: 1.75rem; flex: 1; }
  `],
})
export class StaffShellComponent {
  constructor(
    public auth: AuthService,
    private notifications: NotificationService,
    private router: Router
  ) {
    effect(() => {
      const key = this.recipientKey();
      if (key) void this.notifications.loadFor(key.type, key.id);
    });
  }

  private recipientKey = computed((): { type: NotificationRecipientType; id: string } | null => {
    const emp = this.auth.currentEmployee();
    if (!emp) return null;
    if (emp.roles.includes('Admin')) return { type: 'Admin', id: 'ALL_ADMIN' };
    if (emp.roles.includes('ItSupport')) return { type: 'ItSupport', id: 'ALL_IT_SUPPORT' };
    return { type: 'Employee', id: emp.id };
  });

  unread = computed(() => {
    const key = this.recipientKey();
    return key ? this.notifications.unreadCountFor(key.type, key.id) : 0;
  });

  visibleNavItems = computed(() => {
    const emp = this.auth.currentEmployee();
    if (!emp) return [];
    return NAV_ITEMS.filter(item => !item.rolesAllowed || item.rolesAllowed.some(r => emp.roles.includes(r)));
  });

  async logout() {
    await this.auth.logoutStaff();
    this.router.navigateByUrl('/admin/login');
  }
}
