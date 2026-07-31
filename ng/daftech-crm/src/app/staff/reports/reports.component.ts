import { Component, computed, signal } from '@angular/core';
import { BarChartComponent, BarChartDatum } from '../../shared/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/donut-chart.component';
import { ReportService } from '../../core/services/report.service';
import { Employee, EmployeePerformanceReport, OnTimeReport, SatisfactionSurvey } from '../../core/models';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { SatisfactionSurveyService } from '../../core/services/satisfaction-survey.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ExportChoice, ExportDialogComponent } from './export-dialog.component';

interface ReportDef {
  id: string;
  title: string;
  description: string;
}

const REPORTS: ReportDef[] = [
  { id: 'clients-agreements', title: 'Active Clients & Agreement Status', description: 'All clients with current agreement status and billing tier.' },
  { id: 'tickets-by-filter', title: 'Tickets by Client / Employee / Date Range', description: 'Ticket volume and resolution breakdown across filters.' },
  { id: 'agreements-expiring', title: 'Agreements Expiring Soon or Expired', description: 'Upcoming and past-due agreement renewals.' },
  { id: 'maintenance-history', title: 'Maintenance History', description: 'Internal maintenance records by category, date range, or employee.' },
  { id: 'time-performance', title: 'Employee Time-Log & Performance', description: 'Attendance combined with ticket resolution stats per employee.' },
  { id: 'satisfaction-surveys', title: 'Client Satisfaction Survey Responses', description: 'The 5-question follow-up survey, aggregated across all respondents.' },
];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [BarChartComponent, DonutChartComponent, ExportDialogComponent],
  template: `
    <h1>Reports</h1>
    <p class="text-muted" style="margin-top:0.3rem;">Generate downloadable reports across the system.</p>

    <div class="panel panel-pad" style="margin-top:1.25rem;">
      <div class="chart-header">
        <div>
          <h3>On-Time Ticket Resolution</h3>
          <p class="text-muted" style="font-size:0.82rem; margin-top:0.25rem;">
            "On time" means resolved within {{ report()?.summary?.targetDays ?? '—' }} days of assignment.
          </p>
        </div>
      </div>

      @if (loading()) {
        <p class="text-muted" style="margin-top:1rem;">Loading…</p>
      } @else if (report()) {
        <div class="chart-grid">
          <div class="chart-cell">
            <h4>Overall</h4>
            <app-donut-chart [data]="donutData()" centerLabel="On Time"></app-donut-chart>
          </div>
          <div class="chart-cell">
            <h4>On-Time Rate by Employee</h4>
            <app-bar-chart [chartData]="barData()"></app-bar-chart>
          </div>
        </div>
      }
    </div>

    <div class="grid" style="margin-top:1.25rem;">
      @for (r of reports; track r.id) {
        <div class="panel panel-pad">
          <h3>{{ r.title }}</h3>
          <p class="text-muted" style="font-size:0.83rem; margin-top:0.4rem;">{{ r.description }}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:0.9rem;" (click)="openExport(r)">
            Download as PDF
          </button>
        </div>
      }
    </div>

    @if (exporting(); as target) {
      <app-export-dialog
        [reportTitle]="target.title"
        (closed)="exporting.set(null)"
        (confirmed)="generate(target, $event)"
      ></app-export-dialog>
    }
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1.5rem; align-items: start; }
    .chart-cell h4 { font-size: 0.82rem; margin-bottom: 0.9rem; color: var(--navy-800); }
    @media (max-width: 800px) { .chart-grid { grid-template-columns: 1fr; } }
  `],
})
export class ReportsComponent {
  reports = REPORTS;
  exporting = signal<ReportDef | null>(null);

  report = signal<OnTimeReport | null>(null);
  loading = signal(true);

  constructor(
    private reportsSvc: ReportService,
    private pdf: PdfExportService,
    private surveys: SatisfactionSurveyService,
    private employees: EmployeeService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    void this.load();
  }

  openExport(report: ReportDef) {
    this.exporting.set(report);
  }

  /** Builds the chosen report as a branded PDF and triggers the download. */
  async generate(report: ReportDef, choice: ExportChoice) {
    this.exporting.set(null);
    const options = {
      title: report.title,
      subtitle: choice.subtitle ?? report.description,
      includeMetrics: choice.includeMetrics,
      includeTable: choice.includeTable,
      orientation: choice.orientation,
      generatedBy: this.auth.currentEmployee()?.fullName,
    };

    try {
      switch (report.id) {
        case 'satisfaction-surveys': {
          const rows: SatisfactionSurvey[] = await this.surveys.getAll();
          this.pdf.exportSatisfactionSurveys(rows, options);
          break;
        }
        case 'time-performance': {
          const staff: Employee[] = await this.employees.getAll();
          const reports = await Promise.all(staff.map((e: Employee) => this.reportsSvc.getEmployeePerformanceReport(e.id)));
          this.pdf.exportTable(
            ['Employee', 'Assigned', 'Resolved', 'On-time %', 'Avg. resolution (h)', 'Hours worked'],
            reports.map((r: EmployeePerformanceReport) => [
              r.employeeName, r.ticketsAssigned, r.ticketsResolved,
              r.onTimeRate.toFixed(1), r.averageResolutionHours?.toFixed(1) ?? '—', r.totalHoursWorked.toFixed(1),
            ]),
            options,
            [{ label: 'Employees', value: `${reports.length}` }],
          );
          break;
        }
        default: {
          const onTime = this.report() ?? await this.reportsSvc.getOnTimeResolutionReport();
          this.pdf.exportOnTimeResolution(onTime, options);
        }
      }
      this.toast.success('PDF generated.');
    } catch {
      this.toast.error('The report could not be generated. Please try again.');
    }
  }

  private async load() {
    this.loading.set(true);
    try {
      const r = await this.reportsSvc.getOnTimeResolutionReport();
      this.report.set(r);
    } finally {
      this.loading.set(false);
    }
  }

  donutData = computed((): DonutSlice[] => {
    const r = this.report();
    if (!r) return [];
    return [
      { label: 'On Time', value: r.summary.onTimeCount, color: '#16a34a' },
      { label: 'Late', value: r.summary.lateCount, color: 'var(--brand-red, #dc2626)' },
    ];
  });

  barData = computed((): BarChartDatum[] => {
    const r = this.report();
    if (!r) return [];
    return r.byEmployee.map(e => ({
      label: e.employeeName,
      value: e.onTimeRate,
      color: e.onTimeRate >= 90 ? '#16a34a' : e.onTimeRate >= 70 ? '#b45309' : 'var(--brand-red, #dc2626)',
    }));
  });
}
