import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-staff-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <div class="card panel panel-pad">
        <img src="assets/daftech-logo.png" alt="DAFTECH" class="brand-logo-img brand-logo-lg" style="margin: 0 auto 0.9rem;" />
        <h2>DAFTECH Admin / Staff</h2>
        <p class="text-muted" style="margin: 0.35rem 0 1.25rem;">Sign in with the username and password issued by your Admin.</p>

        <label class="lbl">Username</label>
        <input type="text" [ngModel]="username()" (ngModelChange)="username.set($event)" placeholder="e.g. mf4821" autocomplete="username" />

        <label class="lbl" style="margin-top:0.8rem;">Password</label>
        <input type="password" [ngModel]="password()" (ngModelChange)="password.set($event)" placeholder="Password" autocomplete="current-password" (keydown.enter)="attempt()" />

        <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" [disabled]="submitting()" (click)="attempt()">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>

        @if (result(); as r) {
          <div class="result" [class.blocked]="!r.success">
            @if (r.success) {
              <span>✅ Signed in</span>
            } @else {
              <span>🚫 {{ r.message }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--navy-950); padding: 1rem; }
    .card { width: 380px; text-align: center; }
    .card .lbl, .card input, .card .result { text-align: left; }
    .lbl { display: block; font-size: 0.78rem; font-weight: 600; color: var(--slate-500); margin-bottom: 0.3rem; }
    input { width: 100%; }
    .result { margin-top: 1rem; padding: 0.7rem 0.85rem; border-radius: 8px; background: var(--green-bg); color: var(--green); font-size: 0.85rem; }
    .result.blocked { background: var(--red-bg); color: var(--red); }
  `],
})
export class StaffLoginComponent {
  username = signal('');
  password = signal('');
  submitting = signal(false);
  result = signal<{ success: boolean; message?: string } | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async attempt() {
    if (!this.username().trim() || !this.password()) return;
    this.submitting.set(true);
    try {
      const res = await this.auth.loginEmployee(this.username().trim(), this.password());
      this.result.set(res);
      if (res.success) {
        const dest = this.auth.staffMustChangePassword() ? '/admin/change-password' : '/admin/dashboard';
        setTimeout(() => this.router.navigateByUrl(dest), 300);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
