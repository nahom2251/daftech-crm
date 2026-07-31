import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Employee, DeviceSession, LoginRecord, EmployeeRole, TimeLog, EmployeeRegisteredResult } from '../models';
import { API_BASE_URL } from './api-base';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly _employees = signal<Employee[]>([]);
  private readonly _timeLogs = signal<TimeLog[]>([]);
  readonly employees = this._employees.asReadonly();
  readonly timeLogs = this._timeLogs.asReadonly();

  constructor(private http: HttpClient) {
    void this.refresh();
    void this.refreshTimeLogs();
  }

  async refresh(): Promise<void> {
    const list = await firstValueFrom(this.http.get<Employee[]>(`${API_BASE_URL}/employees`));
    this._employees.set(list);
  }

  /** Fetches the employee list and returns it (also updates the shared signal). */
  async getAll(): Promise<Employee[]> {
    await this.refresh();
    return this._employees();
  }

  async refreshTimeLogs(employeeId?: string): Promise<void> {
    const list = await firstValueFrom(
      this.http.get<TimeLog[]>(`${API_BASE_URL}/time-logs`, employeeId ? { params: { employeeId } } : {})
    );
    this._timeLogs.set(list);
  }

  async clockIn(employeeId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/time-logs/${employeeId}/clock-in`, {}));
    await this.refreshTimeLogs();
  }

  async clockOut(employeeId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/time-logs/${employeeId}/clock-out`, {}));
    await this.refreshTimeLogs();
  }

  activeEmployees(): Employee[] {
    return this._employees().filter(e => e.accountStatus === 'Active');
  }

  getById(id: string): Employee | undefined {
    return this._employees().find(e => e.id === id);
  }

  /**
   * Admin registers a new staff account. The API generates a username and
   * one-time password and returns them ONCE in this response — the caller
   * must show them to the Admin immediately, since they can't be
   * retrieved again afterward.
   */
  async registerEmployee(data: {
    fullName: string; email: string; phoneNumber: string; specialization: string;
    roles: EmployeeRole[]; allowedIpAddresses: string[];
  }): Promise<EmployeeRegisteredResult> {
    const result = await firstValueFrom(this.http.post<EmployeeRegisteredResult>(`${API_BASE_URL}/employees`, data));
    await this.refresh();
    return result;
  }

  async resendCredentialEmail(employeeId: string): Promise<{ emailSent: boolean; emailError?: string }> {
    return firstValueFrom(this.http.post<{ emailSent: boolean; emailError?: string }>(`${API_BASE_URL}/employees/${employeeId}/resend-credential-email`, {}));
  }

  /**
   * Admin disables an employee's account — e.g. on offboarding. The API
   * revokes all active device sessions and blocks future logins in the
   * same request; historical tickets/maintenance/time-logs are untouched.
   */
  async disableEmployee(id: string, reason: string): Promise<void> {
    await firstValueFrom(this.http.post<Employee>(`${API_BASE_URL}/employees/${id}/disable`, { reason }));
    await this.refresh();
  }

  async enableEmployee(id: string): Promise<void> {
    await firstValueFrom(this.http.post<Employee>(`${API_BASE_URL}/employees/${id}/enable`, {}));
    await this.refresh();
  }

  async addAllowedIp(employeeId: string, ip: string): Promise<void> {
    await firstValueFrom(this.http.post<Employee>(`${API_BASE_URL}/employees/${employeeId}/allowed-ips`, { ipAddress: ip }));
    await this.refresh();
  }

  async removeAllowedIp(employeeId: string, ip: string): Promise<void> {
    await firstValueFrom(this.http.delete<Employee>(`${API_BASE_URL}/employees/${employeeId}/allowed-ips/${encodeURIComponent(ip)}`));
    await this.refresh();
  }

  async devicesFor(employeeId: string): Promise<DeviceSession[]> {
    return firstValueFrom(this.http.get<DeviceSession[]>(`${API_BASE_URL}/employees/${employeeId}/devices`));
  }

  async revokeDevice(deviceSessionId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/employees/devices/${deviceSessionId}/revoke`, {}));
  }

  async loginHistoryFor(employeeId: string): Promise<LoginRecord[]> {
    return firstValueFrom(this.http.get<LoginRecord[]>(`${API_BASE_URL}/employees/${employeeId}/login-history`));
  }
}
