import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { GoogleSheetsService } from '../../core/services/google-sheets.service';
import { OneDriveService } from '../../core/services/onedrive.service';

interface SourceState {
  connected: boolean;
  detail: string;
}

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './configuration.html',
  styleUrl: './configuration.less',
})
export class Configuration implements OnInit {
  loading = true;

  /**
   * Real connection state, read from the API rather than set on click.
   * Only sources with a persisted connection can report one — Tally is a
   * one-shot reachability test with nothing stored, so it never shows here.
   */
  googleSheets: SourceState = { connected: false, detail: '' };
  oneDrive: SourceState = { connected: false, detail: '' };

  constructor(
    private router: Router,
    private sheets: GoogleSheetsService,
    private onedrive: OneDriveService
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  /** One request per connector; a failure just leaves that card disconnected. */
  refresh(): void {
    this.loading = true;

    forkJoin({
      google: this.sheets.status().pipe(catchError(() => of(null))),
      drives: this.onedrive.getOneDrives().pipe(catchError(() => of(null))),
    }).subscribe(({ google, drives }) => {
      if (google?.connected) {
        const n = google.sheets?.length || 0;
        this.googleSheets = {
          connected: true,
          detail: n ? `${google.email} · ${n} sheet${n > 1 ? 's' : ''}` : (google.email ?? ''),
        };
      }

      const list = drives?.oneDrives || [];
      if (list.length) {
        this.oneDrive = {
          connected: true,
          detail: list.map((d: any) => d.email).filter(Boolean).join(', '),
        };
      }

      this.loading = false;
    });
  }

  connectTally()       { this.router.navigate(['/tally-config']); }
  connectOneDrive()    { this.router.navigate(['/one-drive-config']); }
  connectGoogleSheet() { this.router.navigate(['/google-sheets-config']); }
}
