import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Client, ClientRegisteredResult } from '../models';
import { API_BASE_URL } from './api-base';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly _clients = signal<Client[]>([]);
  private readonly _loaded = signal(false);
  readonly clients = this._clients.asReadonly();

  constructor(private http: HttpClient) {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const list = await firstValueFrom(this.http.get<Client[]>(`${API_BASE_URL}/clients`));
    this._clients.set(list);
    this._loaded.set(true);
  }

  pendingRequests(): Client[] {
    return this._clients().filter(c => c.accountStatus === 'Pending');
  }

  approvedClients(): Client[] {
    return this._clients().filter(c => c.accountStatus === 'Approved');
  }

  getById(id: string): Client | undefined {
    return this._clients().find(c => c.id === id);
  }

  async submitSignup(data: {
    name: string; idNumber: string; phoneNumber: string; email: string; office: string; location: string;
  }): Promise<Client> {
    const client = await firstValueFrom(this.http.post<Client>(`${API_BASE_URL}/clients/signup`, data));
    await this.refresh();
    return client;
  }

  /**
   * Admin registers a client directly — Approved and credentialed
   * immediately. The response's oneTimePassword is shown ONCE; the caller
   * must display it to the Admin now.
   */
  async registerClient(data: {
    name: string; idNumber: string; phoneNumber: string; email: string; office: string; location: string;
    kycType: string; kycContact: string; itSupportContact?: string;
  }): Promise<ClientRegisteredResult> {
    const result = await firstValueFrom(this.http.post<ClientRegisteredResult>(`${API_BASE_URL}/clients/register`, data));
    await this.refresh();
    return result;
  }

  async resendCredentialEmail(clientId: string): Promise<{ emailSent: boolean; emailError?: string }> {
    return firstValueFrom(this.http.post<{ emailSent: boolean; emailError?: string }>(`${API_BASE_URL}/clients/${clientId}/resend-credential-email`, {}));
  }

  async approve(clientId: string): Promise<void> {
    await firstValueFrom(this.http.post<Client>(`${API_BASE_URL}/clients/${clientId}/approve`, {}));
    await this.refresh();
  }

  async reject(clientId: string, reason: string): Promise<void> {
    await firstValueFrom(this.http.post<Client>(`${API_BASE_URL}/clients/${clientId}/reject`, { reason }));
    await this.refresh();
  }
}
