import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  active: boolean;
  isOwner: boolean;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  invitedAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface TeamResponse {
  organization: { id: string; name: string };
  canManage: boolean;
  emailEnabled: boolean;
  members: Member[];
  invitations: Invitation[];
}

export interface InviteLookup {
  email: string;
  role: 'USER' | 'ADMIN';
  organizationName: string;
  expiresAt: string;
}

export interface InviteResult {
  message: string;
  emailSent: boolean;
  inviteLink?: string;
  invitation: Invitation;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private base = `${environment.API_URL}/org`;

  constructor(private http: HttpClient) {}

  team(): Observable<TeamResponse> {
    return this.http.get<TeamResponse>(`${this.base}/members`);
  }

  invite(email: string, role: 'USER' | 'ADMIN'): Observable<InviteResult> {
    return this.http.post<InviteResult>(`${this.base}/invites`, { email, role });
  }

  resend(id: string): Observable<InviteResult> {
    return this.http.post<InviteResult>(`${this.base}/invites/${id}/resend`, {});
  }

  revoke(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/invites/${id}`);
  }

  setRole(id: string, role: 'USER' | 'ADMIN') {
    return this.http.patch<{ message: string }>(`${this.base}/members/${id}/role`, { role });
  }

  removeMember(id: string) {
    return this.http.delete<{ message: string }>(`${this.base}/members/${id}`);
  }

  // ── Public (no token) ────────────────────────────────────────────────────

  lookupInvite(token: string): Observable<InviteLookup> {
    return this.http.get<InviteLookup>(
      `${this.base}/invites/lookup?token=${encodeURIComponent(token)}`
    );
  }

  acceptInvite(payload: { token: string; name: string; password: string }) {
    return this.http.post<any>(`${this.base}/invites/accept`, payload);
  }
}
