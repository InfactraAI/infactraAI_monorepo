import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { InviteLookup, TeamService } from '../../../core/services/team.service';

/**
 * Public landing page for an emailed invitation. Reachable while signed out —
 * the invitation token is the credential.
 */
@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './accept-invite.html',
  styleUrl: './accept-invite.less',
})
export class AcceptInviteComponent implements OnInit {
  loading = true;
  busy = false;
  invite: InviteLookup | null = null;
  error = '';

  name = '';
  password = '';
  confirmPassword = '';
  hidePassword = true;

  private token = '';

  constructor(
    private team: TeamService,
    private route: ActivatedRoute,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';

    if (!this.token) {
      this.loading = false;
      this.error = 'This link is missing its invitation code. Ask for a fresh invite.';
      return;
    }

    this.team.lookupInvite(this.token).subscribe({
      next: (invite) => { this.invite = invite; this.loading = false; },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'This invitation could not be found.';
      },
    });
  }

  accept(): void {
    if (this.password.length < 8) {
      this.snack.open('Password must be at least 8 characters.', 'Close', { duration: 3000 });
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.snack.open('Passwords do not match.', 'Close', { duration: 3000 });
      return;
    }

    this.busy = true;
    this.team.acceptInvite({ token: this.token, name: this.name, password: this.password }).subscribe({
      next: (res) => {
        // The API signs them in, so go straight to the dashboard.
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.user.role);
        localStorage.setItem('username', res.user.name);
        localStorage.setItem('email', res.user.email);
        localStorage.setItem('orgName', res.organization?.name ?? '');

        this.snack.open(res.message, 'Close', { duration: 4000, panelClass: ['success-snackbar'] });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.busy = false;
        this.snack.open(err?.error?.message || 'Could not accept the invitation.', 'Close', {
          duration: 4000, panelClass: ['error-snackbar'],
        });
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
