import { Location, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tally',
  standalone: true,
  imports: [MatIconModule, CommonModule, FormsModule],
  templateUrl: './tally.html',
  styleUrl: './tally.less',
})
export class Tally {
  constructor(private location: Location, private router: Router, private http: HttpClient) { }

  tallyConnected = false;
  oneDriveConnected = false;
  selectedSource: string = 'Tally';

  form = {
    name: '',
    host: 'localhost',
    port: '9000',
    company: '',
    authType: 'none',
    username: '',
    password: '',
    syncInterval: 15
  };

  goBack() {
    this.location.back();
  }

  showOptional = false;

  toggleOptional() {
    this.showOptional = !this.showOptional;
  }

  testConnection() {
    const payload = {
      host: this.form.host,
      port: Number(this.form.port)
    };

    this.http.post<any>(`${environment.API_URL}/tally/connect`, payload)
      .subscribe({
        next: (res) => {
          this.tallyConnected = true;
          alert(res.message || '✅ Connected');
        },
        error: (err) => {
          this.tallyConnected = false;
          alert(err.error?.message || '❌ Connection failed');
        }
      });
  }

  save() {
    const payload = {
      host: this.form.host,
      port: Number(this.form.port)
    };

    this.http.post<any>(`${environment.API_URL}/tally/sync/ledgers`, payload)
      .subscribe({
        next: (res) => {
          alert(`✅ Synced ${res.count} ledgers`);
        },
        error: (err) => {
          alert(err.error?.message || '❌ Sync failed');
        }
      });
  }
}
