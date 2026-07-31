import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AgreementService } from '../../core/services/agreement.service';
import { TicketService } from '../../core/services/ticket.service';
import { TicketCategory } from '../../core/models';

@Component({
  selector: 'app-submit-issue',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Submit an Issue</h1>
    <p class="text-muted" style="margin-top:0.3rem;">Describe the problem — our team will review and follow up.</p>

    <div class="panel panel-pad" style="margin-top:1.25rem; max-width:520px;">
      @if (!agreement()) {
        <p class="text-muted">No active agreement found on your account — please contact DAFTECH directly.</p>
      } @else {
        <div class="field">
          <label>Category</label>
          <select [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="SqlDatabaseError">SQL/Database error</option>
            <option value="Bug">Bug</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="field" style="margin-top:0.8rem;">
          <label>Description</label>
          <textarea rows="5" [ngModel]="description()" (ngModelChange)="description.set($event)" placeholder="Describe what happened, when, and any error messages…"></textarea>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem;" (click)="submit()">Submit Issue</button>
        @if (submittedId(); as id) {
          <div class="success">Submitted — ticket <span class="mono">{{ id }}</span>. You can track it under My Tickets.</div>
        }
      }
    </div>
  `,
  styles: [`
    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--slate-500); }
    textarea { resize: vertical; width: 100%; }
    select { width: 100%; }
    .success { margin-top: 1rem; padding: 0.7rem 0.9rem; border-radius: 8px; background: var(--green-bg); color: var(--green); font-size: 0.85rem; }
  `],
})
export class SubmitIssueComponent {
  category = signal<TicketCategory>('Bug');
  description = signal('');
  submittedId = signal<string | null>(null);

  constructor(private auth: AuthService, private agreements: AgreementService, private tickets: TicketService) {}

  agreement = computed(() => {
    const client = this.auth.currentClient();
    if (!client) return undefined;
    return this.agreements.forClient(client.id).find(a => a.status === 'Active') ?? this.agreements.forClient(client.id)[0];
  });

  async submit() {
    const client = this.auth.currentClient();
    const agreement = this.agreement();
    if (!client || !agreement || !this.description().trim()) return;
    const ticket = await this.tickets.submitFromClient(client.id, agreement.id, this.description().trim(), this.category());
    this.submittedId.set(ticket.id);
    this.description.set('');
  }
}
