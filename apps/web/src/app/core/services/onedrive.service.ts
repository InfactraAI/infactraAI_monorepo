import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OneDriveService {
  private base = `${environment.API_URL}/onedrive`;

  constructor(private http: HttpClient) {}

  login(formData: any, userId: string): void {
    const query = new URLSearchParams({
      tenantId:     formData.tenantId,
      clientId:     formData.clientId,
      clientSecret: formData.clientSecret,
      redirectUri:  formData.redirectUri,
      department:   formData.department,
      userId,
    }).toString();
    window.location.href = `${this.base}/login?${query}`;
  }

  getOneDrives(userId: string): Observable<any> {
    return this.http.get(`${this.base}/getOneDrives?userId=${userId}`);
  }

  getFiles(userId: string, department: string): Observable<any> {
    return this.http.get(
      `${this.base}/files?userId=${userId}&department=${department}`,
      { withCredentials: true }
    );
  }

  getExcelInventoryHrData(department: string): Observable<any> {
    return this.http.get(`${this.base}/getExcelInventoryHrData?department=${department}`);
  }

  downloadFile(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/download/${id}`, {
      withCredentials: true,
      responseType: 'blob',
    });
  }

  testConnection(data: any): Observable<any> {
    return this.http.post(`${this.base}/test`, data, { withCredentials: true });
  }

  saveConnection(data: any): Observable<any> {
    return this.http.post(`${this.base}/save`, data, { withCredentials: true });
  }

  syncData(itemId: string, tableName: string): Observable<any> {
    return this.http.post(`${this.base}/sync`, { itemId, tableName }, { withCredentials: true });
  }
}
