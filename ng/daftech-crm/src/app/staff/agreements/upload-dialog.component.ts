import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgreementDocument, ALLOWED_EXTENSIONS, FileUploadService } from '../../core/services/file-upload.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Modal dialog for uploading a scanned agreement document. Supports drag-and-drop
 * or the file picker, validates type and size before any bytes leave the browser,
 * and shows live upload progress.
 */
@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-dialog.component.html',
  styleUrls: ['./upload-dialog.component.scss'],
})
export class UploadDialogComponent {
  /** Agreement receiving the document. */
  @Input({ required: true }) agreementId!: string;
  @Input() documentNumber = '';
  @Output() uploaded = new EventEmitter<AgreementDocument>();
  @Output() closed = new EventEmitter<void>();

  readonly accept = ALLOWED_EXTENSIONS.join(',');
  readonly allowedList = ALLOWED_EXTENSIONS.join(', ');

  file = signal<File | null>(null);
  error = signal<string | null>(null);
  progress = signal<number>(0);
  uploading = signal(false);
  dragging = signal(false);

  constructor(private uploads: FileUploadService, private toast: ToastService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) this.select(dropped);
  }

  onPicked(event: Event) {
    const picked = (event.target as HTMLInputElement).files?.[0];
    if (picked) this.select(picked);
  }

  select(file: File) {
    const problem = this.uploads.validate(file);
    if (problem) {
      this.error.set(problem);
      this.file.set(null);
      return;
    }
    this.error.set(null);
    this.file.set(file);
  }

  clear() {
    this.file.set(null);
    this.error.set(null);
    this.progress.set(0);
  }

  sizeLabel(file: File) { return this.uploads.formatSize(file.size); }
  iconLabel(file: File) { return this.uploads.iconFor(file.name); }

  upload() {
    const file = this.file();
    if (!file || this.uploading()) return;

    this.uploading.set(true);
    this.error.set(null);

    this.uploads.uploadAgreementDocument(this.agreementId, file).subscribe({
      next: progress => {
        if (progress.percent >= 0) this.progress.set(progress.percent);
        if (progress.done && progress.result) {
          this.uploading.set(false);
          this.toast.success(`"${file.name}" uploaded.`);
          this.uploaded.emit(progress.result);
          this.closed.emit();
        }
      },
      error: (err: Error) => {
        this.uploading.set(false);
        this.progress.set(0);
        this.error.set(err.message || 'The upload failed. Please try again.');
      },
    });
  }

  close() {
    if (this.uploading()) return;
    this.closed.emit();
  }
}
