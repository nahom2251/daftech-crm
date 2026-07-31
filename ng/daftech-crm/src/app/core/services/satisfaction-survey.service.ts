import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SatisfactionSurvey } from '../models';
import { API_BASE_URL } from './api-base';

export interface SubmitSurveyPayload {
  ticketId: string;
  clientId: string;
  responseSpeedRating: number;
  professionalismRating: number;
  communicationClarityRating: number;
  likelihoodToRecommend: number;
  improvementFeedback?: string;
}

@Injectable({ providedIn: 'root' })
export class SatisfactionSurveyService {
  constructor(private http: HttpClient) {}

  /** All submitted surveys — used by the reports PDF export. */
  async getAll(): Promise<SatisfactionSurvey[]> {
    return firstValueFrom(this.http.get<SatisfactionSurvey[]>(`${API_BASE_URL}/satisfaction-surveys`));
  }

  async submit(payload: SubmitSurveyPayload): Promise<SatisfactionSurvey> {
    return firstValueFrom(this.http.post<SatisfactionSurvey>(`${API_BASE_URL}/satisfaction-surveys`, payload));
  }

  async getForTicket(ticketId: string): Promise<SatisfactionSurvey | null> {
    try {
      return await firstValueFrom(this.http.get<SatisfactionSurvey>(`${API_BASE_URL}/satisfaction-surveys/ticket/${ticketId}`));
    } catch {
      return null; // 404 — no survey submitted yet
    }
  }
}
