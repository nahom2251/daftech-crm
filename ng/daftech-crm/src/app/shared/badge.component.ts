import { Component, Input, computed, signal } from '@angular/core';

const GREEN = new Set(['Active', 'Approved', 'Resolved', 'Free', 'Allowed', 'Closed']);
const RED = new Set(['Expired', 'Rejected', 'Chargeable', 'Disabled', 'Revoked', 'Escalated']);
const AMBER = new Set(['Pending', 'InProgress', 'Submitted', 'Forwarded', 'Assigned', 'Recurring', 'AwaitingClientConfirmation']);

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="badge" [class]="colorClass()">{{ label() }}</span>`,
})
export class BadgeComponent {
  private readonly _status = signal<string>('');
  @Input({ required: true }) set status(value: string) {
    this._status.set(value);
  }

  /** Converts PascalCase API enum values ("AwaitingClientConfirmation") into readable labels ("Awaiting Client Confirmation"). Leaves already-spaced strings (e.g. "SQL/Database error") untouched. */
  label = computed(() => this._status().replace(/([a-z])([A-Z])/g, '$1 $2'));
  colorClass = computed(() => {
    const s = this._status();
    if (GREEN.has(s)) return 'badge-green';
    if (RED.has(s)) return 'badge-red';
    if (AMBER.has(s)) return 'badge-amber';
    return 'badge-slate';
  });
}
