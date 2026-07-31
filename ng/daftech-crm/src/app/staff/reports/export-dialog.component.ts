import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ExportChoice {
  includeMetrics: boolean;
  includeTable: boolean;
  orientation: 'portrait' | 'landscape';
  subtitle?: string;
}

/** Small modal that collects PDF export options before generating the document. */
@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <h2>Export “{{ reportTitle }}” as PDF</h2>
        <label><input type="checkbox" [checked]="includeMetrics()" (change)="includeMetrics.set(!includeMetrics())" /> Include summary metrics</label>
        <label><input type="checkbox" [checked]="includeTable()" (change)="includeTable.set(!includeTable())" /> Include detail table</label>
        <label class="stack">
          <span>Page orientation</span>
          <select [value]="orientation()" (change)="orientation.set($any($event.target).value)">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label class="stack">
          <span>Sub-heading (optional)</span>
          <input type="text" [value]="subtitle()" (input)="subtitle.set($any($event.target).value)" placeholder="e.g. Jan–Jun 2026" />
        </label>
        <footer>
          <button class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
          <button class="btn btn-primary" (click)="emit()">Generate PDF</button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem; }
    .dialog { background: #fff; border-radius: 12px; padding: 1.5rem; width: min(440px, 100%); box-shadow: 0 24px 60px rgba(15,23,42,0.25); }
    h2 { margin: 0 0 1rem; font-size: 1rem; }
    label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.7rem; }
    label.stack { flex-direction: column; align-items: stretch; gap: 0.3rem; }
    label.stack span { font-size: 0.78rem; font-weight: 600; color: var(--slate-500, #64748b); }
    footer { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.2rem; }
  `],
})
export class ExportDialogComponent {
  @Input() reportTitle = 'Report';
  @Output() confirmed = new EventEmitter<ExportChoice>();
  @Output() closed = new EventEmitter<void>();

  includeMetrics = signal(true);
  includeTable = signal(true);
  orientation = signal<'portrait' | 'landscape'>('portrait');
  subtitle = signal('');

  emit() {
    this.confirmed.emit({
      includeMetrics: this.includeMetrics(),
      includeTable: this.includeTable(),
      orientation: this.orientation(),
      subtitle: this.subtitle().trim() || undefined,
    });
  }
}
