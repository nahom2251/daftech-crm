import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { EmployeeService } from '../../core/services/employee.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Time Tracking</h1>
    <p class="text-muted" style="margin-top:0.3rem;">Clock in/out and review attendance across the team.</p>

    @if (me(); as m) {
      <div class="panel panel-pad clock-panel" style="margin-top:1.25rem;">
        <div>
          <div class="clock-label">{{ m.fullName }}</div>
          <div class="text-muted" style="font-size:0.8rem;">{{ todayStatus() }}</div>
        </div>
        <div class="clock-actions">
          @if (!hasOpenLogToday()) {
            <button class="btn btn-primary" (click)="clockIn(m.id)">Clock In</button>
          } @else {
            <button class="btn btn-secondary" (click)="clockOut(m.id)">Clock Out</button>
          }
        </div>
      </div>
    }

    <div class="panel panel-pad" style="margin-top:1.25rem;">
      <div class="filters">
        <select [ngModel]="employeeFilter()" (ngModelChange)="employeeFilter.set($event)">
          <option value="">All employees</option>
          @for (e of employees.employees(); track e.id) { <option [value]="e.id">{{ e.fullName }}</option> }
        </select>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Date</th><th>Start</th><th>Finish</th><th>Total Hours</th></tr></thead>
        <tbody>
          @for (l of filteredLogs(); track l.id) {
            <tr>
              <td>{{ employeeName(l.employeeId) }}</td>
              <td>{{ l.date }}</td>
              <td class="text-muted">{{ l.startTime ? (l.startTime | date:'shortTime') : '—' }}</td>
              <td class="text-muted">{{ l.finishTime ? (l.finishTime | date:'shortTime') : '—' }}</td>
              <td>{{ l.totalHours ? (l.totalHours + ' h') : '—' }}</td>
            </tr>
          }
          @empty { <tr><td colspan="5" class="text-muted" style="text-align:center; padding:1.5rem;">No time logs for this filter.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .clock-panel { display: flex; justify-content: space-between; align-items: center; }
    .clock-label { font-weight: 600; }
    .filters { margin-bottom: 1rem; }
  `],
})
export class TimeTrackingComponent {
  employeeFilter = signal('');

  constructor(public employees: EmployeeService, private auth: AuthService) {}

  me = computed(() => this.auth.currentEmployee());

  hasOpenLogToday = computed(() => {
    const m = this.me();
    if (!m) return false;
    const today = new Date().toISOString().slice(0, 10);
    return this.employees.timeLogs().some(l => l.employeeId === m.id && l.date === today && !l.finishTime);
  });

  todayStatus = computed(() => (this.hasOpenLogToday() ? 'Currently clocked in' : 'Not clocked in today'));

  filteredLogs = computed(() => {
    const filter = this.employeeFilter();
    return this.employees
      .timeLogs()
      .filter(l => !filter || l.employeeId === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  employeeName(id: string): string {
    return this.employees.getById(id)?.fullName ?? id;
  }

  async clockIn(employeeId: string) {
    await this.employees.clockIn(employeeId);
  }

  async clockOut(employeeId: string) {
    await this.employees.clockOut(employeeId);
  }
}
