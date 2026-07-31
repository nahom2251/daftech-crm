import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MaintenanceRecord, MaintenanceStatus } from '../models';
import { API_BASE_URL } from './api-base';

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly _records = signal<MaintenanceRecord[]>([]);
  readonly records = this._records.asReadonly();

  constructor(private http: HttpClient) {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const list = await firstValueFrom(this.http.get<MaintenanceRecord[]>(`${API_BASE_URL}/maintenance`));
    this._records.set(list);
  }

  async create(data: {
    category: string; description: string; performedByEmployeeId: string; status: MaintenanceStatus; remarks?: string;
  }): Promise<MaintenanceRecord> {
    const record = await firstValueFrom(this.http.post<MaintenanceRecord>(`${API_BASE_URL}/maintenance`, data));
    await this.refresh();
    return record;
  }
}
