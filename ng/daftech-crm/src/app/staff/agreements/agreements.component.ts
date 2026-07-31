import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgreementService } from '../../core/services/agreement.service';
import { ClientService } from '../../core/services/client.service';
import { BadgeComponent } from '../../shared/badge.component';
import { Agreement, BillingTier } from '../../core/models';
import { UploadDialogComponent } from './upload-dialog.component';
import { AgreementDocument, FileUploadService } from '../../core/services/file-upload.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-agreements',
  standalone: true,
  imports: [FormsModule, BadgeComponent, UploadDialogComponent],
  template: `
    <div class="header-row">
      <div>
        <h1>Agreements</h1>
        <p class="text-muted" style="margin-top:0.3rem;">Scanned agreement documents, billing tiers, and support windows.</p>
      </div>
      <button class="btn btn-primary" (click)="showForm.set(!showForm())">{{ showForm() ? 'Cancel' : '+ New Agreement' }}</button>
    </div>

    @if (showForm()) {
      <div class="panel panel-pad" style="margin-top:1.25rem;">
        <div class="form-grid">
          <div class="field">
            <label>Client</label>
            <select [ngModel]="form.clientId" (ngModelChange)="form.clientId = $event">
              @for (c of clients.approvedClients(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label>Document Number</label>
            <input type="text" [ngModel]="form.documentNumber" (ngModelChange)="form.documentNumber = $event" placeholder="DOC-2026-0001" />
          </div>
          <div class="field">
            <label>Agreement Place</label>
            <input type="text" [ngModel]="form.agreementPlace" (ngModelChange)="form.agreementPlace = $event" placeholder="Addis Ababa" />
          </div>
          <div class="field">
            <label>Sign Date</label>
            <input type="date" [ngModel]="form.signDate" (ngModelChange)="form.signDate = $event" />
          </div>
          <div class="field">
            <label>Support Window (months)</label>
            <input type="number" [ngModel]="form.supportWindowMonths" (ngModelChange)="form.supportWindowMonths = $event" />
          </div>
          <div class="field">
            <label>Billing Tier</label>
            <select [ngModel]="form.billingTier" (ngModelChange)="form.billingTier = $event">
              <option value="Basic">Basic</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          <div class="field">
            <label>Scanned Document</label>
            <p class="text-muted" style="font-size:0.75rem;">
              Save the agreement first, then use <strong>Upload</strong> in the table to attach the scanned file.
            </p>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem;" (click)="submit()" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save Agreement' }}
        </button>
      </div>
    }

    <div class="panel panel-pad" style="margin-top:1.25rem;">
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Doc #</th><th>Sign Date</th><th>Expiry</th>
            <th>Support Window</th><th>Tier</th><th>Status</th><th>Document</th>
          </tr>
        </thead>
        <tbody>
          @for (a of agreements.agreements(); track a.id) {
            <tr>
              <td>{{ clientName(a.clientId) }}</td>
              <td class="mono">{{ a.documentNumber }}</td>
              <td>{{ a.signDate }}</td>
              <td>{{ a.expiryDate }}</td>
              <td class="text-muted">{{ a.supportWindowMonths }} mo</td>
              <td>{{ a.billingTier }}</td>
              <td><app-badge [status]="a.status"></app-badge></td>
              <td>
                <div class="doc-actions">
                  @if (a.scannedFileUrl) {
                    <button
                      class="btn btn-secondary btn-sm"
                      (click)="download(a)"
                      [disabled]="downloading() === a.id"
                    >{{ downloading() === a.id ? 'Downloading…' : 'Download' }}</button>
                    <button class="btn btn-ghost btn-sm" (click)="uploadTarget.set(a)">Replace</button>
                  } @else {
                    <button class="btn btn-secondary btn-sm" (click)="uploadTarget.set(a)">Upload</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (uploadTarget(); as target) {
      <app-upload-dialog
        [agreementId]="target.id"
        [documentNumber]="target.documentNumber"
        (uploaded)="onUploaded($event)"
        (closed)="uploadTarget.set(null)"
      ></app-upload-dialog>
    }
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field label { font-size: 0.78rem; font-weight: 600; color: var(--slate-500); }
    .doc-actions { display: flex; gap: 0.4rem; }
  `],
})
export class AgreementsComponent {
  showForm = signal(false);
  saving = signal(false);
  /** Agreement whose document is being uploaded, or null when the dialog is closed. */
  uploadTarget = signal<Agreement | null>(null);
  /** Id of the agreement currently downloading, for per-row button state. */
  downloading = signal<string | null>(null);

  form: {
    clientId: string; documentNumber: string; agreementPlace: string; signDate: string;
    supportWindowMonths: number; billingTier: BillingTier;
  } = {
    clientId: '', documentNumber: '', agreementPlace: '', signDate: new Date().toISOString().slice(0, 10),
    supportWindowMonths: 12, billingTier: 'Basic',
  };

  constructor(
    public agreements: AgreementService,
    public clients: ClientService,
    private uploads: FileUploadService,
    private toast: ToastService,
  ) {
    effect(() => {
      const list = clients.approvedClients();
      if (list.length > 0 && !this.form.clientId) {
        this.form.clientId = list[0].id;
      }
    });
  }

  clientName(id: string): string {
    return this.clients.getById(id)?.name ?? id;
  }

  /** Streams the stored document from the API and saves it with its original name. */
  download(agreement: Agreement) {
    if (this.downloading()) return;
    this.downloading.set(agreement.id);

    this.uploads.downloadAgreementDocument(agreement.id).subscribe({
      next: blob => {
        this.downloading.set(null);
        const extension = (agreement.scannedFileUrl ?? '').slice((agreement.scannedFileUrl ?? '').lastIndexOf('.'));
        this.saveBlob(blob, `${agreement.documentNumber || 'agreement'}${extension || ''}`);
      },
      error: () => {
        this.downloading.set(null);
        this.toast.error('The document could not be downloaded. It may have been removed from storage.');
      },
    });
  }

  onUploaded(document: AgreementDocument) {
    this.uploadTarget.set(null);
    void this.agreements.refresh();
    this.toast.success(`Document attached (${this.uploads.formatSize(document.sizeBytes)}).`);
  }

  async submit() {
    if (!this.form.clientId || !this.form.documentNumber || this.saving()) return;
    this.saving.set(true);
    try {
      const created = await this.agreements.createAgreement({ ...this.form });
      this.showForm.set(false);
      this.form = {
        clientId: this.clients.approvedClients()[0]?.id ?? '', documentNumber: '', agreementPlace: '',
        signDate: new Date().toISOString().slice(0, 10), supportWindowMonths: 12, billingTier: 'Basic',
      };
      // Offer the upload straight away so the scanned copy isn't forgotten.
      this.uploadTarget.set(created);
    } catch {
      this.toast.error('The agreement could not be saved. Please check the form and try again.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Triggers a browser download for an in-memory blob. */
  private saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke on the next tick so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
