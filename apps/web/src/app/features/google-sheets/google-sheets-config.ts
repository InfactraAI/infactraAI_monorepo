import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  ConnectedSheet,
  GoogleSheetsService,
  GoogleStatus,
  SheetTab,
} from '../../core/services/google-sheets.service';

declare const gapi: any;
declare const google: any;

const GAPI_SRC = 'https://apis.google.com/js/api.js';

/** Departments that an imported sheet can feed, and the screen each one drives. */
const DEPARTMENTS = [
  { key: 'inventory', label: 'Inventory', feeds: 'the Inventory table' },
  { key: 'hr', label: 'HR', feeds: 'the HR screens' },
];

@Component({
  selector: 'app-google-sheets-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './google-sheets-config.html',
  styleUrl: './google-sheets-config.less',
})
export class GoogleSheetsConfigComponent implements OnInit {
  departments = DEPARTMENTS;

  loading = true;
  busy = false;
  status: GoogleStatus | null = null;

  selectedDepartment = 'inventory';

  /** Set when a picked spreadsheet has more than one tab and needs a choice. */
  pendingPick: {
    spreadsheetId: string;
    title: string;
    department: string;
    tabs: SheetTab[];
    chosen: string;
    mimeType: string;
  } | null = null;

  private pickerApiLoaded = false;

  constructor(
    private sheets: GoogleSheetsService,
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

  // ── OAuth round-trip ──────────────────────────────────────────────────────

  /** Google sends the browser back with ?google=connected or ?google=error. */
  private readReturnParams(): void {
    const params = this.route.snapshot.queryParams;
    if (!params['google']) return;

    if (params['google'] === 'connected') {
      this.toast(`Connected as ${params['email'] || 'your Google account'}`, 'success');
    } else {
      this.toast(this.readableReason(params['reason']), 'error');
    }

    // Clear the params so a refresh doesn't replay the message.
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  private readableReason(reason?: string): string {
    if (!reason) return 'Could not connect to Google.';
    if (reason === 'access_denied') return 'You cancelled the Google sign-in.';
    if (reason === 'missing_code') return 'Google did not return an authorisation code.';
    return reason;
  }

  refresh(): void {
    this.loading = true;
    this.sheets.status().subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  connect(): void {
    this.busy = true;
    this.sheets.authUrl().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  disconnect(): void {
    if (!confirm('Disconnect Google? Imported sheets will stop refreshing.')) return;

    this.busy = true;
    this.sheets.disconnect().subscribe({
      next: () => {
        this.busy = false;
        this.toast('Google account disconnected', 'success');
        this.refresh();
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  // ── Google Picker ─────────────────────────────────────────────────────────

  private loadPickerApi(): Promise<void> {
    if (this.pickerApiLoaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const start = () => gapi.load('picker', {
        callback: () => { this.pickerApiLoaded = true; resolve(); },
        onerror: () => reject(new Error('Could not load the Google file picker.')),
      });

      if (typeof gapi !== 'undefined') return start();

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', start, { once: true });
        existing.addEventListener('error', () => reject(new Error('Could not reach Google.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = GAPI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = start;
      script.onerror = () => reject(new Error('Could not reach Google.'));
      document.head.appendChild(script);
    });
  }

  async openPicker(): Promise<void> {
    const department = this.selectedDepartment;
    this.busy = true;

    try {
      await this.loadPickerApi();

      const cfg = await new Promise<any>((resolve, reject) =>
        this.sheets.pickerConfig().subscribe({ next: resolve, error: reject })
      );

      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(google.picker.DocsViewMode.LIST);

      new google.picker.PickerBuilder()
        // setAppId is what grants this app drive.file access to the picked file.
        .setAppId(cfg.appId)
        .setOAuthToken(cfg.accessToken)
        .setDeveloperKey(cfg.apiKey)
        .setTitle('Choose a spreadsheet')
        .addView(view)
        .setCallback((res: any) => this.onPicked(res, department))
        .build()
        .setVisible(true);

      this.busy = false;
    } catch (err: any) {
      this.busy = false;
      this.toast(err?.message || 'Could not open the Google file picker.', 'error');
    }
  }

  private onPicked(result: any, department: string): void {
    if (result[google.picker.Response.ACTION] !== google.picker.Action.PICKED) return;

    const doc = result[google.picker.Response.DOCUMENTS][0];
    const spreadsheetId = doc[google.picker.Document.ID];
    const title = doc[google.picker.Document.NAME];
    // Native Google Sheets and uploaded .xlsx files are read differently.
    const mimeType = doc[google.picker.Document.MIME_TYPE] || '';

    this.busy = true;
    this.sheets.tabs(spreadsheetId, mimeType).subscribe({
      next: ({ sheets }) => {
        // One tab is the common case — import straight away and stay seamless.
        if (sheets.length <= 1) {
          this.importSheet(spreadsheetId, department, sheets[0]?.title, mimeType);
          return;
        }
        this.busy = false;
        this.pendingPick = { spreadsheetId, title, department, tabs: sheets, chosen: sheets[0].title, mimeType };
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  confirmTab(): void {
    if (!this.pendingPick) return;
    const { spreadsheetId, department, chosen, mimeType } = this.pendingPick;
    this.pendingPick = null;
    this.importSheet(spreadsheetId, department, chosen, mimeType);
  }

  cancelTab(): void {
    this.pendingPick = null;
  }

  private importSheet(spreadsheetId: string, department: string, sheetName?: string, mimeType?: string): void {
    this.busy = true;
    this.sheets.selectSheet({ spreadsheetId, department, sheetName, mimeType }).subscribe({
      next: (res) => {
        this.busy = false;
        this.toast(res.message, 'success');
        this.refresh();
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  // ── Connected sheets ──────────────────────────────────────────────────────

  sync(sheet: ConnectedSheet): void {
    this.busy = true;
    this.sheets.syncSheet(sheet.id).subscribe({
      next: (res) => {
        this.busy = false;
        this.toast(res.message, 'success');
        this.refresh();
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
        this.refresh();
      },
    });
  }

  remove(sheet: ConnectedSheet): void {
    if (!confirm(`Remove "${sheet.title}"? The ${sheet.department} data will be cleared.`)) return;

    this.busy = true;
    this.sheets.removeSheet(sheet.id).subscribe({
      next: () => {
        this.busy = false;
        this.toast('Sheet removed', 'success');
        this.refresh();
      },
      error: (err) => {
        this.busy = false;
        this.toast(this.messageFrom(err), 'error');
      },
    });
  }

  departmentLabel(key: string): string {
    return this.departments.find((d) => d.key === key)?.label || key;
  }

  /** A department already in use gets replaced rather than duplicated. */
  sheetFor(department: string): ConnectedSheet | undefined {
    return this.status?.sheets.find((s) => s.department === department);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
