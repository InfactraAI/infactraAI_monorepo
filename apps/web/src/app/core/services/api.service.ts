import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.API_URL;

  constructor(private http: HttpClient) {}

  sendConnection(data: any): Observable<any> {
    return this.http.post(`${this.base}/connection`, data);
  }

  getConnections(): Observable<any> {
    return this.http.get(`${this.base}/connection`);
  }
}
