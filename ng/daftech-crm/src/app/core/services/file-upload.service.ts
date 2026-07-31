import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api-base';

export interface UploadProgress {
  /** 0-100; -1 while the total size is unknown. */
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  done: boolean;
  result?: AgreementDocument;
}

export interface AgreementDocument {
  agreementId: string;
  scannedFileUrl: string;
  originalFileName: string;
  sizeBytes: number;
  contentType: string;
}

export const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Uploads scanned agreement documents with client-side validation and progress reporting. */
@Injectable({ providedIn: 'root' })
export class FileUploadService {
  constructor(private http: HttpClient) {}

  /** Returns an error message when the file is unacceptable, or null when it's fine. */
  validate(file: File): string | null {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `"${extension || file.name}" isn't an accepted file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`;
    }
    if (file.size === 0) return 'That file is empty.';
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `That file is ${this.formatSize(file.size)}. The limit is ${this.formatSize(MAX_FILE_SIZE_BYTES)}.`;
    }
    return null;
  }

  /** Uploads the document for an agreement, emitting progress until completion. */
  uploadAgreementDocument(agreementId: string, file: File): Observable<UploadProgress> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.http
      .post<AgreementDocument>(`${API_BASE_URL}/agreements/${agreementId}/document`, form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(map(event => this.toProgress(event, file)));
  }

  /** Downloads the stored document as a blob so it can be saved locally. */
  downloadAgreementDocument(agreementId: string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/agreements/${agreementId}/document`, { responseType: 'blob' });
  }

  deleteAgreementDocument(agreementId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/agreements/${agreementId}/document`);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  iconFor(fileName: string): string {
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (extension === '.pdf') return 'PDF';
    if (extension === '.doc' || extension === '.docx') return 'DOC';
    return 'IMG';
  }

  private toProgress(event: HttpEvent<AgreementDocument>, file: File): UploadProgress {
    if (event.type === HttpEventType.UploadProgress) {
      const total = event.total ?? file.size;
      return {
        percent: total ? Math.round((event.loaded / total) * 100) : -1,
        loadedBytes: event.loaded,
        totalBytes: total,
        done: false,
      };
    }

    if (event.type === HttpEventType.Response) {
      return {
        percent: 100,
        loadedBytes: file.size,
        totalBytes: file.size,
        done: true,
        result: event.body ?? undefined,
      };
    }

    return { percent: 0, loadedBytes: 0, totalBytes: file.size, done: false };
  }
}
