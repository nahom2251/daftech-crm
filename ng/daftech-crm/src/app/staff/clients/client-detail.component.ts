import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ClientService } from '../../core/services/client.service';
import { AgreementService } from '../../core/services/agreement.service';
import { TicketService } from '../../core/services/ticket.service';
import { BadgeComponent } from '../../shared/badge.component';
import { TICKET_CATEGORY_LABELS } from '../../core/models';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [RouterLink, BadgeComponent, SlicePipe],
  template: `
    @if (client(); as c) {
      <a routerLink="/admin/clients" class="back">← Back to Clients</a>
      <div class="header-row">
        <div>
          <h1>{{ c.name }}</h1>
          <p class="text-muted" style="margin-top:0.3rem;">ID {{ c.idNumber }} · {{ c.office }}, {{ c.location }}</p>
        </div>
        <app-badge [status]="c.accountStatus"></app-badge>
      </div>

      <div class="grid">
        <div class="panel panel-pad">
          <h3>Profile</h3>
          <dl>
            <dt>Phone</dt><dd>{{ c.phoneNumber }}</dd>
            <dt>KYC Type</dt><dd>{{ c.kycType }}</dd>
            <dt>KYC Contact</dt><dd>{{ c.kycContact }}</dd>
            @if (c.itSupportContact) { <dt>IT Support Contact</dt><dd>{{ c.itSupportContact }}</dd> }
            <dt>Onboarded</dt><dd>{{ c.onboardingDate }}</dd>
            @if (c.rejectionReason) { <dt>Rejection Reason</dt><dd class="text-muted">{{ c.rejectionReason }}</dd> }
          </dl>
        </div>

        <div class="panel panel-pad">
          <h3>Agreements</h3>
          <table>
            <thead><tr><th>Doc #</th><th>Sign Date</th><th>Expiry</th><th>Tier</th><th>Status</th></tr></thead>
            <tbody>
              @for (a of agreements(); track a.id) {
                <tr>
                  <td class="mono">{{ a.documentNumber }}</td>
                  <td>{{ a.signDate }}</td>
                  <td>{{ a.expiryDate }}</td>
                  <td>{{ a.billingTier }}</td>
                  <td><app-badge [status]="a.status"></app-badge></td>
                </tr>
              }
              @empty { <tr><td colspan="5" class="text-muted">No agreements on file.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel panel-pad" style="margin-top:1.25rem;">
        <h3>Full Ticket History with DAFTECH</h3>
        <p class="text-muted" style="font-size:0.8rem; margin: 0.2rem 0 0.9rem;">Used by Admin when assigning new tickets.</p>
        <table>
          <thead><tr><th>Ticket</th><th>Category</th><th>Submitted</th><th>Chargeable</th><th>Status</th></tr></thead>
          <tbody>
            @for (t of tickets(); track t.id) {
              <tr>
                <td class="mono">{{ t.id }}</td>
                <td>{{ categoryLabel(t.category) }}</td>
                <td class="text-muted">{{ t.dateSubmitted | slice:0:10 }}</td>
                <td><app-badge [status]="t.chargeable ? 'Chargeable' : 'Free'"></app-badge></td>
                <td><app-badge [status]="t.status"></app-badge></td>
              </tr>
            }
            @empty { <tr><td colspan="5" class="text-muted">No tickets submitted yet.</td></tr> }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="text-muted">Client not found.</p>
    }
  `,
  styles: [`
    .back { display: inline-block; margin-bottom: 1rem; font-size: 0.82rem; color: var(--slate-500); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
    .grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 1.25rem; align-items: start; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 1rem; margin-top: 0.75rem; font-size: 0.85rem; }
    dt { color: var(--slate-500); font-weight: 600; }
    dd { margin: 0; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class ClientDetailComponent {
  id = input.required<string>();

  constructor(
    private clientsSvc: ClientService,
    private agreementsSvc: AgreementService,
    private ticketsSvc: TicketService
  ) {}

  client = computed(() => this.clientsSvc.getById(this.id()));
  agreements = computed(() => this.agreementsSvc.forClient(this.id()));
  tickets = computed(() => this.ticketsSvc.forClient(this.id()));

  categoryLabel(c: string): string {
    return TICKET_CATEGORY_LABELS[c as keyof typeof TICKET_CATEGORY_LABELS] ?? c;
  }
}
