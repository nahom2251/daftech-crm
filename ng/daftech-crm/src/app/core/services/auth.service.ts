import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Employee, Client, DeviceType } from '../models';
import { API_BASE_URL } from './api-base';
import { SessionService } from './session.service';
import { environment } from '../../../environments/environment';

export interface LoginResult {
  success: boolean;
  message?: string;
  ipAddress?: string;
}

/** Everything persisted for a signed-in principal. */
interface PersistedSession {
  kind: 'Employee' | 'Client';
  /** Bearer token when the API issues one; null for cookie/session-only deployments. */
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch millis at which the token/session must be considered dead. */
  expiresAt: number;
  employee: Employee | null;
  client: Client | null;
}

const STORAGE_KEY = 'daftech.crm.auth';

/**
 * Auth state with durable persistence. Login state, the bearer token (when the
 * API issues one) and its expiry are written to localStorage, so a page refresh
 * no longer logs the user out. On construction the stored session is rehydrated
 * and validated; an expired session is discarded immediately, and a timer
 * auto-logs-out the moment the session lapses while the tab is open.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentEmployee = signal<Employee | null>(null);
  private readonly _currentClient = signal<Client | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _expiresAt = signal<number>(0);

  readonly currentEmployee = this._currentEmployee.asReadonly();
  readonly currentClient = this._currentClient.asReadonly();
  readonly isAuthenticated = computed(() => this._currentEmployee() !== null || this._currentClient() !== null);

  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient, private sessions: SessionService) {
    this.restoreFromStorage();
  }

  // ---------------------------------------------------------------- state

  isStaffAuthenticated(): boolean {
    return this._currentEmployee() !== null && !this.isExpired();
  }

  isClientAuthenticated(): boolean {
    return this._currentClient() !== null && !this.isExpired();
  }

  /** True once logged in but before they've completed the forced password change. */
  staffMustChangePassword(): boolean {
    return this._currentEmployee()?.mustChangePassword ?? false;
  }

  clientMustChangePassword(): boolean {
    return this._currentClient()?.mustChangePassword ?? false;
  }

  hasRole(role: string): boolean {
    return this._currentEmployee()?.roles.includes(role as never) ?? false;
  }

  /** Token for the Authorization header; null when the deployment is session-only. */
  get accessToken(): string | null {
    return this.isExpired() ? null : this._accessToken();
  }

  isExpired(): boolean {
    const expiresAt = this._expiresAt();
    return expiresAt > 0 && Date.now() >= expiresAt;
  }

  // ---------------------------------------------------------------- login

  /**
   * Employee/staff login by system-issued username + password. The server
   * resolves the caller's real IP address itself and logs every attempt,
   * successful or blocked. If mustChangePassword comes back true, the frontend
   * routes straight to the change-password screen before anything else is
   * usable. On success the session is persisted and the presence heartbeat
   * starts (SRS v2.0 §4.8).
   */
  async loginEmployee(
    username: string,
    password: string,
    deviceType: DeviceType = 'Laptop',
    deviceIdentifier: string = 'WEB-SESSION'
  ): Promise<LoginResult> {
    const result = await firstValueFrom(
      this.http.post<{
        success: boolean; message?: string; ipAddress: string; employee: Employee | null;
        mustChangePassword: boolean; accessToken?: string; refreshToken?: string; expiresInSeconds?: number;
      }>(`${API_BASE_URL}/auth/employee-login`, { username, password, deviceType, deviceIdentifier })
    );

    if (result.success && result.employee) {
      this.persist({
        kind: 'Employee',
        accessToken: result.accessToken ?? null,
        refreshToken: result.refreshToken ?? null,
        expiresAt: this.resolveExpiry(result.expiresInSeconds),
        employee: result.employee,
        client: null,
      });
      this.sessions.startHeartbeat('Employee', result.employee.id);
    }
    return { success: result.success, message: result.message, ipAddress: result.ipAddress };
  }

  async loginClient(username: string, password: string): Promise<LoginResult> {
    const result = await firstValueFrom(
      this.http.post<{
        success: boolean; message?: string; client: Client | null; mustChangePassword: boolean;
        accessToken?: string; refreshToken?: string; expiresInSeconds?: number;
      }>(`${API_BASE_URL}/auth/client-login`, { username, password })
    );

    if (result.success && result.client) {
      this.persist({
        kind: 'Client',
        accessToken: result.accessToken ?? null,
        refreshToken: result.refreshToken ?? null,
        expiresAt: this.resolveExpiry(result.expiresInSeconds),
        employee: null,
        client: result.client,
      });
      this.sessions.startHeartbeat('Client', result.client.id);
    }
    return { success: result.success, message: result.message };
  }

  async changeEmployeePassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<void> {
    const employee = this._currentEmployee();
    if (!employee) throw new Error('Not logged in.');
    await firstValueFrom(
      this.http.post(`${API_BASE_URL}/auth/employee/${employee.id}/change-password`, {
        currentPassword, newPassword, confirmNewPassword,
      })
    );
    this._currentEmployee.set({ ...employee, mustChangePassword: false });
    this.writeStorage();
  }

  async changeClientPassword(currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<void> {
    const client = this._currentClient();
    if (!client) throw new Error('Not logged in.');
    await firstValueFrom(
      this.http.post(`${API_BASE_URL}/auth/client/${client.id}/change-password`, {
        currentPassword, newPassword, confirmNewPassword,
      })
    );
    this._currentClient.set({ ...client, mustChangePassword: false });
    this.writeStorage();
  }

  // ---------------------------------------------------------------- refresh

  /**
   * Refreshes the bearer token. Concurrent callers share one in-flight request
   * (the auth interceptor relies on this to avoid a refresh stampede on 401).
   * Resolves to the new token, or null when refresh isn't possible.
   */
  refreshToken(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refreshToken = this.readStorage()?.refreshToken ?? null;
    if (!refreshToken) return Promise.resolve(null);

    this.refreshInFlight = (async () => {
      try {
        const result = await firstValueFrom(
          this.http.post<{ accessToken: string; refreshToken?: string; expiresInSeconds?: number }>(
            `${API_BASE_URL}/auth/refresh`, { refreshToken }
          )
        );
        const stored = this.readStorage();
        if (!stored) return null;
        this.persist({
          ...stored,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? stored.refreshToken,
          expiresAt: this.resolveExpiry(result.expiresInSeconds),
        });
        return result.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private refreshInFlight: Promise<string | null> | null = null;

  // ---------------------------------------------------------------- logout

  async logoutStaff(): Promise<void> {
    const employee = this._currentEmployee();
    this.clear();
    if (employee) {
      try { await this.sessions.closeSession('Employee', employee.id); } catch { /* already gone */ }
    }
  }

  async logoutClient(): Promise<void> {
    const client = this._currentClient();
    this.clear();
    if (client) {
      try { await this.sessions.closeSession('Client', client.id); } catch { /* already gone */ }
    }
  }

  /** Secure logout: wipes every trace of the session from memory and browser storage. */
  clear(): void {
    this._currentEmployee.set(null);
    this._currentClient.set(null);
    this._accessToken.set(null);
    this._expiresAt.set(0);
    if (this.expiryTimer) { clearTimeout(this.expiryTimer); this.expiryTimer = null; }
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.clear();
    } catch { /* storage disabled — nothing to clear */ }
  }

  // ---------------------------------------------------------------- storage

  private persist(session: PersistedSession): void {
    this._currentEmployee.set(session.employee);
    this._currentClient.set(session.client);
    this._accessToken.set(session.accessToken);
    this._expiresAt.set(session.expiresAt);
    this.writeStorage();
    this.scheduleAutoLogout();
  }

  private writeStorage(): void {
    const session: PersistedSession = {
      kind: this._currentEmployee() ? 'Employee' : 'Client',
      accessToken: this._accessToken(),
      refreshToken: this.readStorage()?.refreshToken ?? null,
      expiresAt: this._expiresAt(),
      employee: this._currentEmployee(),
      client: this._currentClient(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Private-browsing mode: in-memory auth still works for this tab.
    }
  }

  private readStorage(): PersistedSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PersistedSession) : null;
    } catch {
      return null;
    }
  }

  /** Auto-login on app initialization when a still-valid session is stored. */
  private restoreFromStorage(): void {
    const stored = this.readStorage();
    if (!stored) return;

    if (stored.expiresAt > 0 && Date.now() >= stored.expiresAt) {
      this.clear();
      return;
    }

    this._currentEmployee.set(stored.employee);
    this._currentClient.set(stored.client);
    this._accessToken.set(stored.accessToken);
    this._expiresAt.set(stored.expiresAt);
    this.scheduleAutoLogout();

    // Resume presence tracking for the restored principal.
    if (stored.employee) this.sessions.startHeartbeat('Employee', stored.employee.id);
    else if (stored.client) this.sessions.startHeartbeat('Client', stored.client.id);
  }

  private scheduleAutoLogout(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const expiresAt = this._expiresAt();
    if (expiresAt <= 0) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) { this.clear(); return; }
    this.expiryTimer = setTimeout(() => this.clear(), delay);
  }

  private resolveExpiry(expiresInSeconds?: number): number {
    const seconds = expiresInSeconds ?? environment.auth.sessionLifetimeMinutes * 60;
    return Date.now() + seconds * 1000;
  }
}
