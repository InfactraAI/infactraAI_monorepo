import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ConnectedSheet {
  id: string;
  spreadsheetId: string;
  title: string;
  sheetName: string | null;
  mimeType?: string | null;
  department: string;
  lastSyncedAt: string | null;
  lastSyncStatus: 'ok' | 'error';
  lastSyncError: string | null;
  rowCount: number;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  sheets: ConnectedSheet[];
}

export interface PickerConfig {
  clientId: string;
  apiKey: string;
  appId: string;
  accessToken: string;
}

export interface SheetTab {
  title: string;
  index: number;
}

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService {
  private base = `${environment.API_URL}/google`;

  constructor(private http: HttpClient) {}

  status(): Observable<GoogleStatus> {
    return this.http.get<GoogleStatus>(`${this.base}/status`);
  }

  /** The consent URL is fetched, not redirected to, so the Bearer token survives. */
  authUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/auth-url`);
  }

  pickerConfig(): Observable<PickerConfig> {
    return this.http.get<PickerConfig>(`${this.base}/picker-config`);
  }

  tabs(spreadsheetId: string, mimeType?: string): Observable<{ title: string; sheets: SheetTab[] }> {
    const q = mimeType ? `?mimeType=${encodeURIComponent(mimeType)}` : '';
    return this.http.get<{ title: string; sheets: SheetTab[] }>(
      `${this.base}/spreadsheets/${encodeURIComponent(spreadsheetId)}/tabs${q}`
    );
  }

  selectSheet(payload: { spreadsheetId?: string; url?: string; department: string; sheetName?: string; mimeType?: string }) {
    return this.http.post<{ message: string; sheet: ConnectedSheet }>(`${this.base}/sheets`, payload);
  }

  syncSheet(id: string) {
    return this.http.post<{ message: string; sheet: ConnectedSheet }>(`${this.base}/sheets/${id}/sync`, {});
  }

  removeSheet(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/sheets/${id}`);
  }

  disconnect() {
    return this.http.delete<{ message: string }>(`${this.base}/disconnect`);
  }
}
