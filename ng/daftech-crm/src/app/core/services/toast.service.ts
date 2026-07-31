import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

/** Minimal notification queue used by the error interceptor and feature components. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string) { this.push('success', message); }
  error(message: string) { this.push('error', message); }
  info(message: string) { this.push('info', message); }

  dismiss(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string) {
    const toast: Toast = { id: this.nextId++, kind, message };
    this._toasts.update(list => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), kind === 'error' ? 8000 : 4000);
  }
}
