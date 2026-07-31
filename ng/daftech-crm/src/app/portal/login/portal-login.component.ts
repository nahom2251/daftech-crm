import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card panel panel-pad">
        <img src="assets/daftech-logo.png" alt="DAFTECH" class="brand-logo-img brand-logo-md" />
        <h2>Client Portal</h2>
        <p class="text-muted" style="margin: 0.35rem 0 1.25rem;">Sign in with the username and password your Admin gave you.</p>

        <label class="lbl">Username</label>
        <input type="text" [ngModel]="username()" (ngModelChange)="username.set($event)" placeholder="e.g. at2001" autocomplete="username" />

        <label class="lbl" style="margin-top:0.8rem;">Password</label>
        <input type="password" [ngModel]="password()" (ngModelChange)="password.set($event)" placeholder="Password" autocomplete="current-password" (keydown.enter)="attempt()" />

        <button class="btn btn-primary" style="width:100%; margin-top:1rem;" [disabled]="submitting()" (click)="attempt()">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>

        @if (error(); as e) { <div class="err">{{ e }}</div> }

        <p class="alt-link">Don't have an account yet? Ask DAFTECH to register you, or request access below.</p>
        <a routerLink="/portal/signup" class="btn btn-outline btn-sm" style="width:100%;">Request Access</a>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--portal-bg); padding: 1rem; }
    .card { width: 380px; text-align: center; }
    .card .lbl, .card input, .card .err { text-align: left; }
    .brand-logo-img { margin: 0 auto 0.75rem; }
    .lbl { display: block; font-size: 0.78rem; font-weight: 600; color: var(--slate-500); margin-bottom: 0.3rem; }
    input { width: 100%; }
    .err { margin-top: 0.9rem; padding: 0.65rem 0.8rem; border-radius: 8px; background: var(--red-bg); color: var(--red); font-size: 0.83rem; }
    .alt-link { font-size: 0.78rem; margin: 1rem 0 0.6rem; text-align: center; color: var(--slate-500); }
  `],
})
export class PortalLoginComponent {
  username = signal('');
  password = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async attempt() {
    if (!this.username().trim() || !this.password()) return;
    this.submitting.set(true);
    try {
      const res = await this.auth.loginClient(this.username().trim(), this.password());
      if (res.success) {
        this.error.set(null);
        const dest = this.auth.clientMustChangePassword() ? '/portal/change-password' : '/portal/my-tickets';
        this.router.navigateByUrl(dest);
      } else {
        this.error.set(res.message ?? 'Unable to log in.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
