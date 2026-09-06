import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Invitation, Member, TeamService, TeamResponse } from '../../core/services/team.service';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './team.html',
  styleUrl: './team.less',
})
export class TeamComponent implements OnInit {
  loading = true;
  busy = false;
  data: TeamResponse | null = null;

  inviteEmail = '';
  inviteRole: 'USER' | 'ADMIN' = 'USER';

  /** Shown when SMTP is unconfigured, so an admin can pass the link on. */
  manualLink: { email: string; url: string } | null = null;

  constructor(private team: TeamService, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.team.team().subscribe({
      next: (data) => { this.data = data; this.loading = false; },
      error: (err) => { this.loading = false; this.toast(this.msg(err), 'error'); },
    });
  }

  invite(): void {
    const email = this.inviteEmail.trim();
    if (!email) return;

    this.busy = true;
    this.team.invite(email, this.inviteRole).subscribe({
      next: (res) => {
        this.busy = false;
        this.inviteEmail = '';
        this.manualLink = res.inviteLink ? { email, url: res.inviteLink } : null;
        this.toast(res.message, 'success');
        this.refresh();
      },
      error: (err) => { this.busy = false; this.toast(this.msg(err), 'error'); },
    });
  }

  resend(inv: Invitation): void {
    this.busy = true;
    this.team.resend(inv.id).subscribe({
      next: (res) => {
        this.busy = false;
        this.manualLink = res.inviteLink ? { email: inv.email, url: res.inviteLink } : null;
        this.toast(res.message, 'success');
        this.refresh();
      },
      error: (err) => { this.busy = false; this.toast(this.msg(err), 'error'); },
    });
  }

  revoke(inv: Invitation): void {
    if (!confirm(`Revoke the invitation to ${inv.email}?`)) return;
    this.busy = true;
    this.team.revoke(inv.id).subscribe({
      next: (res) => { this.busy = false; this.toast(res.message, 'success'); this.refresh(); },
      error: (err) => { this.busy = false; this.toast(this.msg(err), 'error'); },
    });
  }

  toggleRole(m: Member): void {
    const role = m.role === 'ADMIN' ? 'USER' : 'ADMIN';
    this.busy = true;
    this.team.setRole(m.id, role).subscribe({
      next: (res) => { this.busy = false; this.toast(res.message, 'success'); this.refresh(); },
      error: (err) => { this.busy = false; this.toast(this.msg(err), 'error'); },
    });
  }

  remove(m: Member): void {
    if (!confirm(`Remove ${m.email} from the organisation?`)) return;
    this.busy = true;
    this.team.removeMember(m.id).subscribe({
      next: (res) => { this.busy = false; this.toast(res.message, 'success'); this.refresh(); },
      error: (err) => { this.busy = false; this.toast(this.msg(err), 'error'); },
    });
  }

  copyLink(): void {
    if (!this.manualLink) return;
    navigator.clipboard?.writeText(this.manualLink.url)
      .then(() => this.toast('Link copied', 'success'))
      .catch(() => this.toast('Could not copy — select the link and copy it.', 'error'));
  }

  initials(name: string): string {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  private msg(err: any): string {
    return err?.error?.message || err?.message || 'Something went wrong.';
  }

  private toast(message: string, kind: 'success' | 'error'): void {
    this.snack.open(message, 'Close', {
      duration: 4000,
      panelClass: [kind === 'success' ? 'success-snackbar' : 'error-snackbar'],
    });
  }
}
