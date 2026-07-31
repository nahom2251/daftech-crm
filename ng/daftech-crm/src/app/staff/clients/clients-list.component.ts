import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../../core/services/client.service';
import { BadgeComponent } from '../../shared/badge.component';
import { ClientRegisteredResult } from '../../core/models';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [RouterLink, FormsModule, BadgeComponent],
  template: `
    <div class="header-row">
      <div>
        <h1>Clients</h1>
        <p class="text-muted" style="margin-top:0.3rem;">Customer profiles and their agreement / ticket history.</p>
      </div>
      <button class="btn btn-primary" (click)="toggleForm()">{{ showForm() ? 'Cancel' : '+ Register Client' }}</button>
    </div>

    @if (showForm()) {
      <div class="panel panel-pad" style="margin-top:1.25rem;">
        @if (!justRegistered()) {
          <div class="form-grid">
            <div class="field"><label>Name / Organization</label><input type="text" [ngModel]="form.name" (ngModelChange)="form.name = $event" /></div>
            <div class="field"><label>ID Number</label><input type="text" [ngModel]="form.idNumber" (ngModelChange)="form.idNumber = $event" /></div>
            <div class="field"><label>Phone Number</label><input type="text" [ngModel]="form.phoneNumber" (ngModelChange)="form.phoneNumber = $event" /></div>
            <div class="field"><label>Email</label><input type="email" [ngModel]="form.email" (ngModelChange)="form.email = $event" placeholder="used to send login credentials" /></div>
            <div class="field"><label>Office</label><input type="text" [ngModel]="form.office" (ngModelChange)="form.office = $event" /></div>
            <div class="field"><label>Location</label><input type="text" [ngModel]="form.location" (ngModelChange)="form.location = $event" /></div>
            <div class="field"><label>KYC Type</label><input type="text" [ngModel]="form.kycType" (ngModelChange)="form.kycType = $event" placeholder="Business License…" /></div>
            <div class="field"><label>KYC Contact</label><input type="text" [ngModel]="form.kycContact" (ngModelChange)="form.kycContact = $event" placeholder="Name — phone/email" /></div>
            <div class="field"><label>IT Support Contact (optional)</label><input type="text" [ngModel]="form.itSupportContact" (ngModelChange)="form.itSupportContact = $event" /></div>
          </div>
          <button class="btn btn-primary" style="margin-top:1rem;" [disabled]="registering()" (click)="submit()">
            {{ registering() ? 'Registering…' : 'Register Client' }}
          </button>
        } @else {
          <div class="credential-panel">
            <h4>✅ Account created — share these credentials now</h4>
            <p class="text-muted" style="font-size:0.82rem; margin: 0.3rem 0 0.9rem;">
              This one-time password will not be shown again.
              @if (justRegistered()!.emailSent) {
                An email with these details was also sent to {{ justRegistered()!.client.email }}.
              } @else {
                The credential email could not be sent{{ justRegistered()!.emailError ? ' (' + justRegistered()!.emailError + ')' : '' }} — relay these to {{ justRegistered()!.client.name }} directly, or retry below.
              }
            </p>
            <div class="cred-row"><span class="cred-label">Username</span><span class="mono cred-value">{{ justRegistered()!.username }}</span></div>
            <div class="cred-row"><span class="cred-label">One-time password</span><span class="mono cred-value">{{ justRegistered()!.oneTimePassword }}</span></div>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
              @if (!justRegistered()!.emailSent) {
                <button class="btn btn-outline btn-sm" [disabled]="resending()" (click)="retryEmail(justRegistered()!.client.id)">
                  {{ resending() ? 'Retrying…' : 'Retry Email' }}
                </button>
              }
              <button class="btn btn-secondary btn-sm" (click)="closeCredentialPanel()">Done</button>
            </div>
          </div>
        }
      </div>
    }

    <div class="panel panel-pad" style="margin-top:1.25rem;">
      <div class="filters">
        <input type="text" placeholder="Search by name or ID number…" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
          <option value="">All statuses</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>ID Number</th><th>Office</th><th>Location</th><th>Status</th><th>Onboarded</th><th></th></tr>
        </thead>
        <tbody>
          @for (c of filtered(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td class="mono text-muted">{{ c.idNumber }}</td>
              <td>{{ c.office }}</td>
              <td>{{ c.location }}</td>
              <td><app-badge [status]="c.accountStatus"></app-badge></td>
              <td class="text-muted">{{ c.onboardingDate }}</td>
              <td><a [routerLink]="['/admin/clients', c.id]" class="btn btn-outline btn-sm">View</a></td>
            </tr>
          }
          @empty {
            <tr><td colspan="7" class="text-muted" style="text-align:center; padding: 1.5rem;">No clients match your filters.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .filters { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
    .filters input { flex: 1; }
    .filters select { width: 180px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--slate-500); }
    .credential-panel { background: var(--green-bg); border-radius: 10px; padding: 1.1rem; }
    .credential-panel h4 { color: var(--green); font-size: 0.92rem; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px solid rgba(0,0,0,0.06); }
    .cred-row:first-of-type { border-top: none; }
    .cred-label { font-size: 0.8rem; color: var(--slate-500); }
    .cred-value { font-size: 0.95rem; font-weight: 700; color: var(--navy-900); }
  `],
})
export class ClientsListComponent {
  query = signal('');
  statusFilter = signal('');
  showForm = signal(false);
  registering = signal(false);
  resending = signal(false);
  justRegistered = signal<ClientRegisteredResult | null>(null);

  form = { name: '', idNumber: '', phoneNumber: '', email: '', office: '', location: '', kycType: '', kycContact: '', itSupportContact: '' };

  constructor(public clients: ClientService) {}

  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const status = this.statusFilter();
    return this.clients.clients().filter(c => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.idNumber.toLowerCase().includes(q);
      const matchesStatus = !status || c.accountStatus === status;
      return matchesQuery && matchesStatus;
    });
  });

  toggleForm() {
    this.justRegistered.set(null);
    this.showForm.set(!this.showForm());
  }

  async submit() {
    if (!this.form.name || !this.form.idNumber) return;
    this.registering.set(true);
    try {
      const result = await this.clients.registerClient({
        ...this.form,
        itSupportContact: this.form.itSupportContact || undefined,
      });
      this.justRegistered.set(result);
      this.form = { name: '', idNumber: '', phoneNumber: '', email: '', office: '', location: '', kycType: '', kycContact: '', itSupportContact: '' };
    } finally {
      this.registering.set(false);
    }
  }

  async retryEmail(clientId: string) {
    this.resending.set(true);
    try {
      const result = await this.clients.resendCredentialEmail(clientId);
      const current = this.justRegistered();
      if (current) {
        this.justRegistered.set({ ...current, emailSent: result.emailSent, emailError: result.emailError });
      }
    } finally {
      this.resending.set(false);
    }
  }

  closeCredentialPanel() {
    this.justRegistered.set(null);
    this.showForm.set(false);
  }
}
