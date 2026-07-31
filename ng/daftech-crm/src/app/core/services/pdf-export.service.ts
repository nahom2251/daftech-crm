import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmployeePerformanceReport, OnTimeReport, SatisfactionSurvey } from '../models';

export interface PdfExportOptions {
  /** Report title printed in the header. */
  title: string;
  /** Optional sub-heading (date range, filter description). */
  subtitle?: string;
  /** Include the summary metric tiles. */
  includeMetrics?: boolean;
  /** Include the detail table. */
  includeTable?: boolean;
  /** A4 orientation. */
  orientation?: 'portrait' | 'landscape';
  /** Person or account generating the export. */
  generatedBy?: string;
}

const BRAND_RED: [number, number, number] = [190, 30, 45];
const NAVY: [number, number, number] = [15, 34, 64];
const MUTED: [number, number, number] = [110, 120, 135];

/**
 * Builds branded PDF reports client-side with jsPDF + jspdf-autotable.
 * Every export shares the same header (DAFTECH CRM wordmark, title, generated
 * timestamp) and footer (page numbers, confidentiality note).
 */
@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /** Employee performance export — metric tiles plus the per-employee table. */
  exportEmployeePerformance(
    report: EmployeePerformanceReport,
    options: PdfExportOptions = { title: 'Employee Performance Report' }
  ): void {
    const doc = this.createDocument(options);
    let y = this.drawHeader(doc, options);

    if (options.includeMetrics !== false) {
      y = this.drawMetrics(doc, y, [
        { label: 'Tickets assigned', value: `${report.ticketsAssigned}` },
        { label: 'Tickets resolved', value: `${report.ticketsResolved}` },
        { label: 'On-time rate', value: `${report.onTimeRate.toFixed(1)}%` },
        { label: 'Avg. resolution', value: report.averageResolutionHours != null ? `${report.averageResolutionHours.toFixed(1)} h` : '—' },
        { label: 'Avg. satisfaction', value: report.averageSatisfactionScore != null ? `${report.averageSatisfactionScore.toFixed(1)}%` : '—' },
        { label: 'Hours worked', value: `${report.totalHoursWorked.toFixed(1)} h` },
      ]);
    }

    if (options.includeTable !== false) {
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Employee', report.employeeName],
          ['Tickets assigned', `${report.ticketsAssigned}`],
          ['Tickets resolved', `${report.ticketsResolved}`],
          ['On-time resolution rate', `${report.onTimeRate.toFixed(1)}%`],
          ['Average resolution time', report.averageResolutionHours != null ? `${report.averageResolutionHours.toFixed(1)} hours` : 'No resolved tickets yet'],
          ['Average satisfaction score', report.averageSatisfactionScore != null ? `${report.averageSatisfactionScore.toFixed(1)}%` : 'No ratings yet'],
          ['Total hours worked', `${report.totalHoursWorked.toFixed(1)} hours`],
        ],
        ...this.tableTheme(),
      });
      y = this.afterTable(doc, y);
    }

    if (report.aiNarrative) {
      this.drawNarrative(doc, y, 'Narrative summary', report.aiNarrative);
    } else if (report.aiUnavailableReason) {
      this.drawNarrative(doc, y, 'Narrative summary', `Not available: ${report.aiUnavailableReason}`);
    }

    this.finish(doc, options, `employee-performance-${this.slug(report.employeeName)}`);
  }

  /** On-time resolution export — overall summary plus the per-employee breakdown. */
  exportOnTimeResolution(
    report: OnTimeReport,
    options: PdfExportOptions = { title: 'On-Time Ticket Resolution' }
  ): void {
    const doc = this.createDocument(options);
    let y = this.drawHeader(doc, options);

    if (options.includeMetrics !== false) {
      y = this.drawMetrics(doc, y, [
        { label: 'Resolved on time', value: `${report.summary.onTimeCount}` },
        { label: 'Resolved late', value: `${report.summary.lateCount}` },
        { label: 'On-time rate', value: `${report.summary.onTimeRate.toFixed(1)}%` },
        { label: 'Target', value: `${report.summary.targetDays} days` },
      ]);
    }

    if (options.includeTable !== false) {
      autoTable(doc, {
        startY: y,
        head: [['Employee', 'On time', 'Late', 'On-time rate']],
        body: report.byEmployee.map(e => [
          e.employeeName, `${e.onTimeCount}`, `${e.lateCount}`, `${e.onTimeRate.toFixed(1)}%`,
        ]),
        ...this.tableTheme(),
      });
    }

    this.finish(doc, options, 'on-time-resolution');
  }

  /** Client satisfaction survey export — averages plus every response. */
  exportSatisfactionSurveys(
    surveys: SatisfactionSurvey[],
    options: PdfExportOptions = { title: 'Client Satisfaction Survey Responses' }
  ): void {
    const doc = this.createDocument({ orientation: 'landscape', ...options });
    let y = this.drawHeader(doc, options);

    const average = (pick: (s: SatisfactionSurvey) => number) =>
      surveys.length ? (surveys.reduce((sum, s) => sum + pick(s), 0) / surveys.length).toFixed(2) : '—';

    if (options.includeMetrics !== false) {
      y = this.drawMetrics(doc, y, [
        { label: 'Responses', value: `${surveys.length}` },
        { label: 'Response speed', value: `${average(s => s.responseSpeedRating)} / 5` },
        { label: 'Professionalism', value: `${average(s => s.professionalismRating)} / 5` },
        { label: 'Clarity', value: `${average(s => s.communicationClarityRating)} / 5` },
        { label: 'Would recommend', value: `${average(s => s.likelihoodToRecommend)} / 5` },
      ]);
    }

    if (options.includeTable !== false) {
      autoTable(doc, {
        startY: y,
        head: [['Submitted', 'Ticket', 'Speed', 'Professional', 'Clarity', 'Recommend', 'Feedback']],
        body: surveys.map(s => [
          new Date(s.submittedAt).toLocaleDateString(),
          s.ticketId.slice(0, 8),
          `${s.responseSpeedRating}`,
          `${s.professionalismRating}`,
          `${s.communicationClarityRating}`,
          `${s.likelihoodToRecommend}`,
          s.improvementFeedback ?? '—',
        ]),
        ...this.tableTheme(),
      });
    }

    this.finish(doc, options, 'client-satisfaction-surveys');
  }

  /** Generic tabular export used by the remaining report cards. */
  exportTable(
    columns: string[],
    rows: (string | number)[][],
    options: PdfExportOptions,
    metrics: { label: string; value: string }[] = []
  ): void {
    const doc = this.createDocument(options);
    let y = this.drawHeader(doc, options);

    if (metrics.length && options.includeMetrics !== false) y = this.drawMetrics(doc, y, metrics);

    if (options.includeTable !== false) {
      autoTable(doc, {
        startY: y,
        head: [columns],
        body: rows.map(row => row.map(cell => `${cell}`)),
        ...this.tableTheme(),
      });
    }

    this.finish(doc, options, this.slug(options.title));
  }

  // ------------------------------------------------------------ internals

  private createDocument(options: PdfExportOptions): jsPDF {
    return new jsPDF({ orientation: options.orientation ?? 'portrait', unit: 'pt', format: 'a4' });
  }

  private drawHeader(doc: jsPDF, options: PdfExportOptions): number {
    const width = doc.internal.pageSize.getWidth();

    doc.setFillColor(...NAVY);
    doc.rect(0, 0, width, 64, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DAFTECH', 40, 30);
    doc.setTextColor(...BRAND_RED);
    doc.text('CRM', 128, 30);

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Customer Relationship Management', 40, 46);

    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(options.title, 40, 96);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const generated = `Generated ${new Date().toLocaleString()}${options.generatedBy ? ` by ${options.generatedBy}` : ''}`;
    doc.text(generated, 40, 112);
    if (options.subtitle) doc.text(options.subtitle, 40, 126);

    return options.subtitle ? 146 : 132;
  }

  private drawMetrics(doc: jsPDF, y: number, metrics: { label: string; value: string }[]): number {
    const width = doc.internal.pageSize.getWidth();
    const perRow = Math.min(3, metrics.length);
    const gap = 12;
    const tileWidth = (width - 80 - gap * (perRow - 1)) / perRow;
    const tileHeight = 46;

    metrics.forEach((metric, index) => {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      const x = 40 + column * (tileWidth + gap);
      const tileY = y + row * (tileHeight + gap);

      doc.setFillColor(246, 248, 251);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, tileY, tileWidth, tileHeight, 5, 5, 'FD');

      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(metric.label.toUpperCase(), x + 10, tileY + 17);

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(metric.value, x + 10, tileY + 36);
    });

    const rows = Math.ceil(metrics.length / perRow);
    return y + rows * (tileHeight + gap) + 8;
  }

  private drawNarrative(doc: jsPDF, y: number, heading: string, body: string): void {
    const width = doc.internal.pageSize.getWidth();
    const startY = Math.min(y + 10, doc.internal.pageSize.getHeight() - 120);

    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(heading, 40, startY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 70, 85);
    doc.text(doc.splitTextToSize(body, width - 80), 40, startY + 16);
  }

  private tableTheme() {
    return {
      styles: { fontSize: 9, cellPadding: 6, textColor: [40, 48, 62] as [number, number, number] },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
      margin: { left: 40, right: 40 },
    };
  }

  private afterTable(doc: jsPDF, fallback: number): number {
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return (last?.finalY ?? fallback) + 20;
  }

  /** Stamps page numbers + footer on every page, then triggers the download. */
  private finish(doc: jsPDF, options: PdfExportOptions, fileNameBase: string): void {
    const pageCount = doc.getNumberOfPages();
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240);
      doc.line(40, height - 42, width - 40, height - 42);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text('DAFTECH CRM — confidential. For internal use only.', 40, height - 26);
      doc.text(`Page ${page} of ${pageCount}`, width - 40, height - 26, { align: 'right' });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`${fileNameBase}-${stamp}.pdf`);
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
