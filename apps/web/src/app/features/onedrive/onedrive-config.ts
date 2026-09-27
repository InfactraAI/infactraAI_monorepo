import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { OneDriveService } from '../../core/services/onedrive.service';

// Destinations inside Infactra, not OneDrive folders. HR is listed but
// disabled — hr.ts fetches imported data and discards it.
const DEPARTMENTS = [
  { key: 'inventory', label: 'Inventory', feeds: 'Shows up in the Inventory table', available: true },
  { key: 'hr', label: 'HR', feeds: 'The HR screens can\'t display imported data yet', available: false },
];

/**
 * The Azure app is platform config now, so this screen no longer asks anyone
 * for a client ID or secret — it picks a department and hands off to Microsoft.
 */
@Component({
  selector: 'app-one-drive-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './onedrive-config.html',
  styleUrl: './onedrive-config.less',
})
export class OneDriveConfigComponent implements OnInit {
  departments = DEPARTMENTS;
  selectedDepartment = 'inventory';

  loading = true;
  busy = false;
  drives: any[] = [];

  constructor(
    private oneDriveService: OneDriveService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.readReturnParams();
    this.refresh();
  }

  goBack(): void {
    this.location.back();
  }

  private readReturnParams(): void {
    const params = this.route.snapshot.queryParams;
    if (!params['onedrive']) return;

    if (params['onedrive'] === 'connected') {
      this.toast(`Connected as ${params['email'] || 'your Microsoft account'}`, 'success');
    } else {
      this.toast(params['reason'] || 'Could not connect to OneDrive.', 'error');
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  refresh(): void {
    this.loading = true;
    this.oneDriveService.getOneDrives().subscribe({
      next: (res) => {
        this.drives = res.oneDrives || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  connect(): void {
    if (!this.departments.find((d) => d.key === this.selectedDepartment)?.available) {
      this.toast('That destination cannot display imported data yet.', 'error');
      return;
    }
    this.busy = true;
    this.oneDriveService.authUrl(this.selectedDepartment).subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  sync(department: string): void {
    this.busy = true;
    this.oneDriveService.getFiles(department).subscribe({
      next: (res) => {
        this.busy = false;
        this.toast(`Imported ${res.totalRows} rows from ${res.fileName}`, 'success');
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  driveFor(department: string) {
    return this.drives.find((d) => d.department === department);
  }

  private messageFrom(err: any): string {
    return err?.error?.message || err?.message || 'Something went wrong.';
  }

  private toast(message: string, kind: 'success' | 'error'): void {
    this.snack.open(message, 'Close', {
      duration: 4000,
      panelClass: [kind === 'success' ? 'success-snackbar' : 'error-snackbar'],
    });
  }
}
