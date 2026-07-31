import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PwaManifestService } from './core/services/pwa-manifest.service';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <router-outlet></router-outlet>
    <div class="toast-stack">
      <div *ngFor="let toast of toasts.toasts()" class="toast" [class]="'toast-' + toast.kind" (click)="toasts.dismiss(toast.id)">
        {{ toast.message }}
      </div>
    </div>
  `,
  styles: [`
    .toast-stack { position: fixed; right: 1rem; bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; z-index: 2000; }
    .toast { max-width: 340px; padding: 0.7rem 0.9rem; border-radius: 8px; font-size: 0.82rem; color: #fff; cursor: pointer; box-shadow: 0 10px 30px rgba(15,23,42,0.2); }
    .toast-success { background: #16a34a; }
    .toast-error { background: #be1e2d; }
    .toast-info { background: #0f2240; }
  `],
})
export class AppComponent {
  constructor(pwaManifest: PwaManifestService, public toasts: ToastService) {
    pwaManifest.init();
  }
}
