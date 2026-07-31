import { Component, computed, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { TicketService } from '../../core/services/ticket.service';

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <img src="assets/daftech-logo.png" alt="DAFTECH" class="brand-logo-img brand-logo-sm" />
          <span class="brand-name">DAFTECH Client Portal</span>
        </div>
        <nav>
          <a routerLink="/portal/submit-issue" routerLinkActive="active">Submit Issue</a>
          <a routerLink="/portal/my-tickets" routerLinkActive="active">My Tickets</a>
          <a routerLink="/portal/confirm-resolution" routerLinkActive="active" class="bell">
            Confirm Resolution
            @if (awaitingCount() > 0) { <span class="bell-count">{{ awaitingCount() }}</span> }
          </a>
          <a routerLink="/portal/notifications" routerLinkActive="active" class="bell">
            Notifications
            @if (unread() > 0) { <span class="bell-count">{{ unread() }}</span> }
          </a>
        </nav>
        <div class="who">
          <span>{{ auth.currentClient()?.name }}</span>
          <button class="btn btn-outline btn-sm" (click)="logout()">Log out</button>
        </div>
      </header>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; background: var(--portal-bg); }
    .topbar {
      background: #fff; border-bottom: 1px solid var(--slate-200); padding: 0.8rem 1.5rem;
      display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 0.55rem; }
    .brand-name { font-weight: 600; font-size: 0.9rem; }
    nav { display: flex; gap: 1.2rem; flex: 1; }
    nav a { font-size: 0.86rem; color: var(--slate-500); font-weight: 500; padding: 0.3rem 0; position: relative; }
    nav a.active { color: var(--portal-accent); }
    .bell-count {
      background: var(--red); color: #fff; font-size: 0.62rem; font-weight: 700;
      border-radius: 999px; padding: 0.05rem 0.35rem; margin-left: 0.3rem;
    }
    .who { display: flex; align-items: center; gap: 0.7rem; font-size: 0.85rem; }
    .content { padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto; }
  `],
})
export class PortalShellComponent {
  constructor(
    public auth: AuthService,
    private notifications: NotificationService,
    private ticketsSvc: TicketService,
    private router: Router
  ) {
    effect(() => {
      const client = this.auth.currentClient();
      if (client) void this.notifications.loadFor('Client', client.id);
    });
  }

  awaitingCount = computed(() => {
    const client = this.auth.currentClient();
    return client ? this.ticketsSvc.awaitingConfirmationForClient(client.id).length : 0;
  });

  unread = computed(() => {
    const client = this.auth.currentClient();
    if (!client) return 0;
    return this.notifications.unreadCountFor('Client', client.id);
  });

  async logout() {
    await this.auth.logoutClient();
    this.router.navigateByUrl('/portal/login');
  }
}
