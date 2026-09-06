import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * The organisation is taken from the JWT server-side — no userId or orgId is
 * ever sent from the browser, so one tenant cannot read another's data by
 * editing a URL.
 */
@Injectable({ providedIn: 'root' })
export class OneDriveService {
  private base = `${environment.API_URL}/onedrive`;

  constructor(private http: HttpClient) {}

  /** Returns the Microsoft consent URL; the caller navigates to it. */
  authUrl(department: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.base}/login?department=${encodeURIComponent(department)}`
    );
  }

  getOneDrives(): Observable<any> {
    return this.http.get(`${this.base}/getOneDrives`);
  }

  getFiles(department: string): Observable<any> {
    return this.http.get(`${this.base}/files?department=${encodeURIComponent(department)}`);
  }

  getExcelInventoryHrData(department: string): Observable<any> {
    return this.http.get(
      `${this.base}/getExcelInventoryHrData?department=${encodeURIComponent(department)}`
    );
  }

  downloadFile(id: string, accountId: string): Observable<Blob> {
    return this.http.get(
      `${this.base}/download/${id}?accountId=${encodeURIComponent(accountId)}`,
      { responseType: 'blob' }
    );
  }
}
