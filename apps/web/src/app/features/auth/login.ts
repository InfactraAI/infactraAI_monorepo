import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatFormFieldModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.less',
})
export class login implements OnInit {

  // FORM FIELDS
  name = '';
  organizationName = '';
  contactPerson = '';
  email = '';
  address = '';
  gst = '';
  mobile = '';
  password = '';
  confirmPassword = '';

  // UI STATE
  hidePassword = true;
  error = '';
  mode: 'login' | 'register' | 'forgot' | 'reset' = 'login';
  token: string = '';
  floatLabelType: any = 'never';

  constructor(
    private loginService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snack: MatSnackBar
  ) {
    const urlToken = this.route.snapshot.params['token'];
    if (urlToken) {
      this.mode = 'reset';
      this.token = urlToken;
    }
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.mode = 'reset';
      }
    });
  }

  toggleMode(mode: 'login' | 'register' | 'forgot' | 'reset') {
    this.mode = mode;
    this.error = '';
    this.name = '';
    this.organizationName = '';
    this.email = '';
    this.address = '';
    this.mobile = '';
    this.password = '';
    this.confirmPassword = '';
  }

  login() {
    this.loginService.login(this.email, this.password).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.user.role);
        localStorage.setItem('username', res.user.name);
        localStorage.setItem('email', res.user.email);
        localStorage.setItem('orgName', res.organization?.name ?? '');
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.snack.open(
          err.error?.message || 'Login failed. Please try again.',
          'Close',
          { duration: 3000, panelClass: ['error-snackbar'] }
        );
      }
    });
  }

  register() {
    if (this.password !== this.confirmPassword) {
      this.snack.open('Passwords do not match.', 'Close', { duration: 3000 });
      return;
    }

    if (!this.organizationName.trim()) {
      this.snack.open('Organisation name is required.', 'Close', { duration: 3000 });
      return;
    }

    const payload = {
      name: this.name,
      organizationName: this.organizationName,
      mobile: this.mobile,
      email: this.email,
      address: this.address,
      password: this.password
    };

    this.loginService.register(payload).subscribe({
      next: () => {
        this.snack.open('Organisation created. Please sign in.', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
        this.toggleMode('login');
      },
      error: err => {
        this.snack.open(err.error?.message || 'Registration failed. Please try again.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  sendResetLink() {
    this.loginService.sendOtp(this.email).subscribe({
      next: () => {
        this.snack.open('Reset link sent successfully.', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
      },
      error: (err: any) => {
        this.snack.open(err.error?.message || 'Failed to send reset link.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  resetPassword() {
    if (this.password !== this.confirmPassword) {
      this.snack.open('Passwords do not match.', 'Close', { duration: 3000 });
      return;
    }

    this.loginService.verifyOtp(this.token, this.password, this.confirmPassword).subscribe({
      next: () => {
        this.password = '';
        this.confirmPassword = '';
        this.mode = 'login';
        this.snack.open('Password updated successfully.', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
      },
      error: (err: any) => {
        this.snack.open(err.error?.message || 'Failed to reset password.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }
}
