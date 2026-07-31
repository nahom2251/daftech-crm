import { Component, computed } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TicketService } from '../../core/services/ticket.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/badge.component';
import { TicketStatus, TICKET_CATEGORY_LABELS } from '../../core/models';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [BadgeComponent, SlicePipe],
  template: `
    <h1>Tickets</h1>
    <p class="text-muted" style="margin-top:0.3rem;">
      Client-submitted support issues. Assignment is automatic — the system picks the employee with the fewest open tickets the moment IT Support forwards a ticket.
    </p>

    @if (isAdmin()) {
      <div class="panel panel-pad" style="margin-top:1.25rem;">
        <h3>Escalated — Needs Admin Review</h3>
        <p class="text-muted" style="font-size:0.8rem; margin: 0.2rem 0 0.9rem;">
          The client rated these below the 90/100 satisfaction threshold after resolution.
        </p>
        <table>
          <thead><tr><th>Ticket</th><th>Client</th><th>Assigned To</th><th>Rating</th><th></th></tr></thead>
          <tbody>
            @for (t of tickets.escalated(); track t.id) {
              <tr>
                <td class="mono">{{ t.id.slice(0,8) }}</td>
                <td>{{ t.clientName }}</td>
                <td class="text-muted">{{ t.assignedEmployeeName ?? '—' }}</td>
                <td><span class="badge badge-red">{{ t.satisfactionStars }}★ ({{ t.satisfactionScore }}/100)</span></td>
                <td class="text-muted" style="font-size:0.8rem;">{{ t.description }}</td>
              </tr>
            }
            @empty { <tr><td colspan="5" class="text-muted" style="text-align:center; padding:1rem;">No escalations right now.</td></tr> }
          </tbody>
        </table>
      </div>
    }

    <div class="panel panel-pad" style="margin-top:1.25rem;">
      <h3>All Tickets</h3>
      <table style="margin-top:0.75rem;">
        <thead><tr><th>Ticket</th><th>Client</th><th>Category</th><th>Submitted</th><th>Assigned</th><th>Chargeable</th><th>Status</th><th>Satisfaction</th><th></th></tr></thead>
        <tbody>
          @for (t of tickets.tickets(); track t.id) {
            <tr>
              <td class="mono">{{ t.id.slice(0,8) }}</td>
              <td>{{ t.clientName }}</td>
              <td>{{ categoryLabel(t.category) }}</td>
              <td class="text-muted">{{ t.dateSubmitted | slice:0:10 }}</td>
              <td class="text-muted">{{ t.assignedEmployeeName ?? '—' }}</td>
              <td><app-badge [status]="t.chargeable ? 'Chargeable' : 'Free'"></app-badge></td>
              <td><app-badge [status]="t.status"></app-badge></td>
              <td class="text-muted">{{ t.satisfactionScore != null ? t.satisfactionScore + '/100' : '—' }}</td>
              <td>
                @if (canForward(t)) {
                  <button class="btn btn-outline btn-sm" (click)="forward(t.id)">Forward</button>
                }
                @if (canUpdateStatus(t)) {
                  <select #st style="margin-right:0.3rem;">
                    <option value="InProgress" [selected]="t.status === 'InProgress'">In Progress</option>
                    <option value="Resolved" [selected]="t.status === 'Resolved'">Resolved</option>
                  </select>
                  <button class="btn btn-outline btn-sm" (click)="updateStatus(t.id, st.value)">Update</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TicketsComponent {
  constructor(
    public tickets: TicketService,
    public employees: EmployeeService,
    private auth: AuthService
  ) {}

  isAdmin = computed(() => this.auth.currentEmployee()?.roles.includes('Admin') ?? false);
  isItSupport = computed(() => this.auth.currentEmployee()?.roles.includes('ItSupport') ?? false);

  categoryLabel(c: string): string {
    return TICKET_CATEGORY_LABELS[c as keyof typeof TICKET_CATEGORY_LABELS] ?? c;
  }

  canForward(t: { status: TicketStatus }): boolean {
    return this.isItSupport() && t.status === 'Submitted';
  }

  canUpdateStatus(t: { assignedEmployeeId?: string; status: TicketStatus }): boolean {
    const emp = this.auth.currentEmployee();
    if (!emp) return false;
    return emp.roles.includes('EmployeeTechnician') && t.assignedEmployeeId === emp.id && ['Assigned', 'InProgress'].includes(t.status);
  }

  async forward(ticketId: string) {
    const emp = this.auth.currentEmployee();
    if (!emp) return;
    await this.tickets.forward(ticketId, emp.id);
  }

  async updateStatus(ticketId: string, status: string) {
    const actor = this.auth.currentEmployee()?.fullName ?? 'Staff';
    await this.tickets.updateStatus(ticketId, status as TicketStatus, actor);
  }
}
