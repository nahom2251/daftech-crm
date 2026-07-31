import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

/**
 * A single origin can only have one <link rel="manifest"> active at a
 * time, but DAFTECH CRM is really two installable experiences (Admin/
 * Staff vs Client Portal) sharing one deployment. This swaps the
 * document's manifest link to the matching variant whenever the route
 * crosses between /admin and /portal, so "Install App" on each surface
 * picks up the right name, icon, and start_url.
 */
@Injectable({ providedIn: 'root' })
export class PwaManifestService {
  private currentVariant: 'admin' | 'portal' | null = null;

  constructor(private router: Router) {}

  init(): void {
    this.applyForUrl(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.applyForUrl(e.urlAfterRedirects));
  }

  private applyForUrl(url: string): void {
    const variant: 'admin' | 'portal' = url.startsWith('/portal') ? 'portal' : 'admin';
    if (variant === this.currentVariant) return;
    this.currentVariant = variant;

    const link = document.getElementById('app-manifest') as HTMLLinkElement | null;
    if (!link) return;

    link.href = variant === 'portal' ? 'manifest-portal.webmanifest' : 'manifest.webmanifest';
  }
}
