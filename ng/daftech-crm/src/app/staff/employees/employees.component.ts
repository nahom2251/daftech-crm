import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { EmployeeService } from '../../core/services/employee.service';
import { BadgeComponent } from '../../shared/badge.component';
import { EmployeeRole, DeviceSession, LoginRecord, EMPLOYEE_ROLE_LABELS, EmployeeRegisteredResult } from '../../core/models';

const SPECIALIZATIONS = ['Front-end', 'Back-end', 'Database'];

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [FormsModule, BadgeComponent, DatePipe, DecimalPipe],
  template: `
    <div class="header-row">
      <div>
        <h1>Employees</h1>
        <p class="text-muted" style="margin-top:0.3rem;">Staff accounts, roles, and access control.</p>
      </div>
      <button class="btn btn-primary" (click)="toggleForm()">{{ showForm() ? 'Cancel' : '+ New Employee' }}</button>
    </div>

    @if (showForm()) {
      <div class="panel panel-pad" style="margin-top:1.25rem;">
        @if (!justRegistered()) {
          <div class="form-grid">
            <div class="field">
              <label>Full Name</label>
              <input type="text" [ngModel]="form.fullName" (ngModelChange)="form.fullName = $event" />
            </div>
            <div class="field">
              <label>Email</label>
              <input type="email" [ngModel]="form.email" (ngModelChange)="form.email = $event" placeholder="used to send login credentials" />
            </div>
            <div class="field">
              <label>Phone Number</label>
              <input type="text" [ngModel]="form.phoneNumber" (ngModelChange)="form.phoneNumber = $event" />
            </div>
            <div class="field">
              <label>Specialization</label>
              <select [ngModel]="form.specialization" (ngModelChange)="form.specialization = $event">
                @for (s of specializations; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Role(s)</label>
              <div class="checks">
                @for (r of allRoles; track r) {
                  <label class="check">
                    <input type="checkbox" [checked]="form.roles.includes(r)" (change)="toggleRole(r)" /> {{ roleLabel(r) }}
                  </label>
                }
              </div>
            </div>
            <div class="field">
              <label>Allowed IP Addresses (optional — blank = unrestricted)</label>
              <input type="text" [ngModel]="ipInput" (ngModelChange)="ipInput = $event" placeholder="196.188.20.10, 196.188.20.11" />
            </div>
          </div>
          <button class="btn btn-primary" style="margin-top:1rem;" [disabled]="registering()" (click)="submit()">
            {{ registering() ? 'Registering…' : 'Register Employee' }}
          </button>
        } @else {
          <div class="credential-panel">
            <h4>✅ Account created — share these credentials now</h4>
            <p class="text-muted" style="font-size:0.82rem; margin: 0.3rem 0 0.9rem;">
              This one-time password will not be shown again.
              @if (justRegistered()!.emailSent) {
                An email with these details was also sent to {{ justRegistered()!.employee.email }}.
              } @else {
                The credential email could not be sent{{ justRegistered()!.emailError ? ' (' + justRegistered()!.emailError + ')' : '' }} — relay these to {{ justRegistered()!.employee.fullName }} directly, or retry below.
              }
            </p>
            <div class="cred-row"><span class="cred-label">Username</span><span class="mono cred-value">{{ justRegistered()!.username }}</span></div>
            <div class="cred-row"><span class="cred-label">One-time password</span><span class="mono cred-value">{{ justRegistered()!.oneTimePassword }}</span></div>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
              @if (!justRegistered()!.emailSent) {
                <button class="btn btn-outline btn-sm" [disabled]="resending()" (click)="retryEmail(justRegistered()!.employee.id)">
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
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Specialization</th><th>Role(s)</th><th>Open Tickets</th><th>Avg. Satisfaction</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (e of employees.employees(); track e.id) {
            <tr>
              <td>{{ e.fullName }}</td>
              <td class="text-muted">{{ e.email }}</td>
              <td class="text-muted">{{ e.phoneNumber }}</td>
              <td>{{ e.specialization }}</td>
              <td>{{ e.roles.map(roleLabel).join(', ') }}</td>
              <td>{{ e.openTicketCount }}</td>
              <td class="text-muted">{{ e.averageSatisfactionScore != null ? (e.averageSatisfactionScore | number:'1.0-0') + '/100' : '—' }}</td>
              <td><app-badge [status]="e.accountStatus"></app-badge></td>
              <td><button class="btn btn-outline btn-sm" (click)="toggleExpand(e.id)">{{ expandedId() === e.id ? 'Hide' : 'Access & Devices' }}</button></td>
            </tr>
            @if (expandedId() === e.id) {
              <tr>
                <td colspan="9">
                  <div class="expand-panel">
                    <div class="expand-cols">
                      <div>
                        <h4>Account</h4>
                        @if (e.accountStatus === 'Active') {
                          <div class="disable-row">
                            <input type="text" placeholder="Reason (e.g. left the company)…" [ngModel]="disableReason()" (ngModelChange)="disableReason.set($event)" />
                            <button class="btn btn-danger btn-sm" (click)="disable(e.id)">Disable Account</button>
                          </div>
                        } @else {
                          <p class="text-muted" style="font-size:0.82rem;">
                            Disabled {{ e.disabledAt | date:'medium' }}@if (e.disabledReason) {<span> — {{ e.disabledReason }}</span>}.
                            Historical tickets, maintenance, and time logs remain on record.
                          </p>
                          <button class="btn btn-secondary btn-sm" (click)="enable(e.id)">Re-enable Account</button>
                        }

                        <h4 style="margin-top:1.1rem;">Allowed IP Addresses</h4>
                        @if (e.allowedIpAddresses.length === 0) {
                          <p class="text-muted" style="font-size:0.82rem;">No restriction — this account can log in from any IP.</p>
                        }
                        <ul class="ip-list">
                          @for (ip of e.allowedIpAddresses; track ip) {
                            <li><span class="mono">{{ ip }}</span> <button class="link-btn" (click)="removeIp(e.id, ip)">remove</button></li>
                          }
                        </ul>
                        <div class="add-ip-row">
                          <input type="text" placeholder="Add IP address…" [ngModel]="newIp()" (ngModelChange)="newIp.set($event)" />
                          <button class="btn btn-outline btn-sm" (click)="addIp(e.id)">Add</button>
                        </div>
                      </div>

                      <div>
                        <h4>Known Devices</h4>
                        <table class="inner-table">
                          <thead><tr><th>Device</th><th>Type</th><th>Last IP</th><th>Last Seen</th><th>Status</th><th></th></tr></thead>
                          <tbody>
                            @for (d of devices(); track d.id) {
                              <tr>
                                <td class="mono">{{ d.deviceIdentifier }}</td>
                                <td>{{ d.deviceType }}</td>
                                <td class="mono">{{ d.ipAddress }}</td>
                                <td class="text-muted">{{ d.lastSeen | date:'short' }}</td>
                                <td><app-badge [status]="d.accessStatus"></app-badge></td>
                                <td>
                                  @if (d.accessStatus === 'Allowed') {
                                    <button class="btn btn-outline btn-sm" (click)="revokeDevice(e.id, d.id)">Revoke</button>
                                  }
                                </td>
                              </tr>
                            }
                            @empty { <tr><td colspan="6" class="text-muted">No devices recorded yet.</td></tr> }
                          </tbody>
                        </table>

                        <h4 style="margin-top:1.1rem;">Login History</h4>
                        <table class="inner-table">
                          <thead><tr><th>When</th><th>IP Address</th><th>Device</th><th>Result</th></tr></thead>
                          <tbody>
                            @for (l of loginHistory(); track l.id) {
                              <tr>
                                <td class="text-muted">{{ l.timestamp | date:'short' }}</td>
                                <td class="mono">{{ l.ipAddress }}</td>
                                <td>{{ l.deviceIdentifier }}</td>
                                <td>
                                  @if (l.allowed) {
                                    <span class="badge badge-green">Allowed</span>
                                  } @else {
                                    <span class="badge badge-red" [title]="l.reason">Blocked</span>
                                  }
                                </td>
                              </tr>
                            }
                            @empty { <tr><td colspan="4" class="text-muted">No login attempts recorded yet.</td></tr> }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--slate-500); }
    .checks { display: flex; gap: 0.9rem; flex-wrap: wrap; padding-top: 0.3rem; }
    .credential-panel { background: var(--green-bg); border-radius: 10px; padding: 1.1rem; }
    .credential-panel h4 { color: var(--green); font-size: 0.92rem; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px solid rgba(0,0,0,0.06); }
    .cred-row:first-of-type { border-top: none; }
    .cred-label { font-size: 0.8rem; color: var(--slate-500); }
    .cred-value { font-size: 0.95rem; font-weight: 700; color: var(--navy-900); }
    .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 400; }
    .expand-panel { background: var(--slate-50); border-radius: 10px; padding: 1.1rem; }
    .expand-cols { display: grid; grid-template-columns: 1fr 1.6fr; gap: 1.5rem; }
    .expand-cols h4 { font-size: 0.82rem; margin-bottom: 0.5rem; color: var(--navy-800); }
    .disable-row, .add-ip-row { display: flex; gap: 0.5rem; }
    .disable-row input, .add-ip-row input { flex: 1; }
    .ip-list { list-style: none; padding: 0; margin: 0.4rem 0 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .ip-list li { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; }
    .link-btn { background: none; border: none; color: var(--red); font-size: 0.75rem; padding: 0; }
    .inner-table { font-size: 0.8rem; }
    .inner-table th, .inner-table td { padding: 0.45rem 0.6rem; }
    @media (max-width: 900px) { .expand-cols { grid-template-columns: 1fr; } }
  `],
})
export class EmployeesComponent {
  showForm = signal(false);
  expandedId = signal<string | null>(null);
  disableReason = signal('');
  newIp = signal('');
  ipInput = '';
  registering = signal(false);
  resending = signal(false);
  justRegistered = signal<EmployeeRegisteredResult | null>(null);

  devices = signal<DeviceSession[]>([]);
  loginHistory = signal<LoginRecord[]>([]);

  allRoles: EmployeeRole[] = ['Admin', 'ItSupport', 'EmployeeTechnician'];
  specializations = SPECIALIZATIONS;
  roleLabel = (r: EmployeeRole) => EMPLOYEE_ROLE_LABELS[r];

  form: { fullName: string; email: string; phoneNumber: string; specialization: string; roles: EmployeeRole[] } = {
    fullName: '', email: '', phoneNumber: '', specialization: SPECIALIZATIONS[0], roles: [],
  };

  constructor(public employees: EmployeeService) {}

  toggleForm() {
    this.justRegistered.set(null);
    this.showForm.set(!this.showForm());
  }

  toggleRole(r: EmployeeRole) {
    this.form.roles = this.form.roles.includes(r) ? this.form.roles.filter(x => x !== r) : [...this.form.roles, r];
  }

  async toggleExpand(id: string) {
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    this.disableReason.set('');
    this.newIp.set('');
    await this.loadAccessPanel(id);
  }

  private async loadAccessPanel(id: string) {
    const [devices, history] = await Promise.all([
      this.employees.devicesFor(id),
      this.employees.loginHistoryFor(id),
    ]);
    this.devices.set(devices);
    this.loginHistory.set(history);
  }

  async disable(id: string) {
    await this.employees.disableEmployee(id, this.disableReason() || 'Left the company');
    this.disableReason.set('');
    await this.loadAccessPanel(id);
  }

  async enable(id: string) {
    await this.employees.enableEmployee(id);
  }

  async addIp(id: string) {
    const ip = this.newIp().trim();
    if (ip) await this.employees.addAllowedIp(id, ip);
    this.newIp.set('');
  }

  async removeIp(id: string, ip: string) {
    await this.employees.removeAllowedIp(id, ip);
  }

  async revokeDevice(employeeId: string, deviceSessionId: string) {
    await this.employees.revokeDevice(deviceSessionId);
    await this.loadAccessPanel(employeeId);
  }

  async submit() {
    if (!this.form.fullName || !this.form.email || this.form.roles.length === 0) return;
    const ips = this.ipInput.split(',').map(s => s.trim()).filter(Boolean);
    this.registering.set(true);
    try {
      const result = await this.employees.registerEmployee({
        fullName: this.form.fullName, email: this.form.email, phoneNumber: this.form.phoneNumber,
        specialization: this.form.specialization, roles: this.form.roles, allowedIpAddresses: ips,
      });
      this.justRegistered.set(result);
      this.form = { fullName: '', email: '', phoneNumber: '', specialization: SPECIALIZATIONS[0], roles: [] };
      this.ipInput = '';
    } finally {
      this.registering.set(false);
    }
  }

  async retryEmail(employeeId: string) {
    this.resending.set(true);
    try {
      const result = await this.employees.resendCredentialEmail(employeeId);
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
