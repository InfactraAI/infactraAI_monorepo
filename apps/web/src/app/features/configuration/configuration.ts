import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { GoogleSheetsService } from '../../core/services/google-sheets.service';
import { OneDriveService } from '../../core/services/onedrive.service';

interface Connector {
  key: string;
  name: string;
  icon: string;
  group: string;
  /** Built and usable. Everything else is a placeholder. */
  live: boolean;
  route?: string;
  /** Filled from the API for connectors that persist a connection. */
  connected?: boolean;
  detail?: string;
}

const GROUPS = ['Files & spreadsheets', 'Accounting', 'Warehouses', 'Analytics', 'Commerce'];

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './configuration.html',
  styleUrl: './configuration.less',
})
export class Configuration implements OnInit {
  loading = true;
  groups = GROUPS;

  /**
   * The catalogue, as data. Previously fourteen near-identical blocks of
   * markup plus eight booleans that were set on click and read by nothing.
   */
  connectors: Connector[] = [
    { key: 'sheets',   name: 'Google Sheets', icon: 'googlesheet.png', group: 'Files & spreadsheets', live: true, route: '/google-sheets-config' },
    { key: 'onedrive', name: 'OneDrive',      icon: 'onedrive.png',    group: 'Files & spreadsheets', live: true, route: '/one-drive-config' },
    { key: 'tally',    name: 'Tally',         icon: 'tally.png',       group: 'Accounting',           live: true, route: '/tally-config' },
    { key: 'zoho',     name: 'Zoho Books',    icon: 'zoho.png',        group: 'Accounting',           live: true },
    { key: 'bigquery', name: 'BigQuery',      icon: 'BigQuery.png',    group: 'Warehouses',           live: true },
    { key: 'postgres', name: 'Postgres',      icon: 'postgresql.jpg',  group: 'Warehouses',           live: true },
    { key: 'mysql',    name: 'MySQL',         icon: 'mysql.png',       group: 'Warehouses',           live: true },
    { key: 'oracle',   name: 'Oracle DB',     icon: 'oracle.png',      group: 'Warehouses',           live: true },
    { key: 'mixpanel', name: 'Mixpanel',      icon: 'mixpanel.png',    group: 'Analytics',            live: true },
    { key: 'ga',       name: 'Google Analytics', icon: 'analytics.png', group: 'Analytics',           live: true },
    { key: 'zohocrm',  name: 'Zoho CRM',      icon: 'zoho-crm.png',    group: 'Commerce',             live: true },
    { key: 'salesforce', name: 'Salesforce',  icon: 'salesforce.webp', group: 'Commerce',             live: true },
    { key: 'amazon',   name: 'Amazon Seller', icon: 'amazon.png',      group: 'Commerce',             live: true },
  ];

  constructor(
    private router: Router,
    private sheets: GoogleSheetsService,
    private onedrive: OneDriveService
  ) {}

  ngOnInit(): void { this.refresh(); }

  /** One request per connector that persists state; a failure just leaves it disconnected. */
  refresh(): void {
    this.loading = true;

    forkJoin({
      google: this.sheets.status().pipe(catchError(() => of(null))),
      drives: this.onedrive.getOneDrives().pipe(catchError(() => of(null))),
    }).subscribe(({ google, drives }) => {
      const sheets = this.connectors.find((c) => c.key === 'sheets')!;
      if (google?.connected) {
        const n = google.sheets?.length || 0;
        sheets.connected = true;
        sheets.detail = n ? `${google.email} · ${n} sheet${n > 1 ? 's' : ''}` : (google.email ?? '');
      }

      const list = drives?.oneDrives || [];
      const od = this.connectors.find((c) => c.key === 'onedrive')!;
      if (list.length) {
        od.connected = true;
        od.detail = list.map((d: any) => d.email).filter(Boolean).join(', ');
      }

      this.loading = false;
    });
  }

  inGroup(group: string): Connector[] {
    return this.connectors.filter((c) => c.group === group);
  }

  open(c: Connector): void {
    if (c.route) this.router.navigate([c.route]);
  }
}
