import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LogoService {
  private api = `${environment.API_URL}/company`;

  constructor(private http: HttpClient) {}

  uploadLogo(logo: File) {
    const formData = new FormData();
    formData.append('logo', logo);
    return this.http.post(`${this.api}/upload-logo`, formData);
  }

  getCompany() {
    return this.http.get(`${this.api}/profile`);
  }

  updateCompany(data: any) {
    return this.http.post(`${this.api}/update`, data);
  }
}
