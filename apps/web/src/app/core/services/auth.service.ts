import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = `${environment.API_URL}/auth`;

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post(`${this.api}/login`, { email, password });
  }

  saveSession(res: any) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('role', res.user.role);
    localStorage.setItem('userId', res.user._id);
    localStorage.setItem('username', res.user.name);
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  get role() {
    return localStorage.getItem('role');
  }

  isLoggedIn() {
    return !!localStorage.getItem('token');
  }

  register(payload: any) {
    return this.http.post(`${this.api}/register`, payload);
  }

  sendOtp(email: string) {
    return this.http.post(`${this.api}/forgotPassword`, { email });
  }

  verifyOtp(token: string, password: string, newPassword?: string) {
    return this.http.post(`${this.api}/resetPassword`, { token, password, newPassword });
  }
}
