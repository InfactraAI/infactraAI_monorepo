import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import * as XLSX from 'xlsx';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { OneDriveService } from '../../core/services/onedrive.service';

@Component({
  selector: 'app-one-drive-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './onedrive-config.html',
  styleUrl: './onedrive-config.less'
})
export class OneDriveConfigComponent implements OnInit {

  configForm!: FormGroup;
  files: any[] = [];
  isConnected: boolean = false;
  loading: boolean = false;
  metadata: any = null;
  userId: string = localStorage.getItem('userId') || '';

  constructor(
    private fb: FormBuilder,
    private oneDriveService: OneDriveService,
    private location: Location
  ) { }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.configForm = this.fb.group({
      redirectUri:  ['', Validators.required],
      clientId:     ['', Validators.required],
      tenantId:     [{ value: 'common', disabled: true }],
      clientSecret: ['', Validators.required],
      department:   ['', Validators.required],
    });
    this.isConnected = false;
  }

  login(): void {
    this.oneDriveService.login(this.configForm.getRawValue(), this.userId);
  }

  testConnection(): void {
    if (this.configForm.invalid) {
      alert("Please fill all required fields");
      return;
    }
    this.loading = true;
    this.oneDriveService.testConnection(this.configForm.value)
      .subscribe({
        next: () => {
          this.isConnected = true;
          this.loading = false;
          alert("Connection Successful");
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          alert("Connection Failed");
        }
      });
  }

  testAndSave(): void {
    if (this.configForm.invalid) {
      alert("Form is invalid");
      return;
    }
    this.loading = true;
    this.oneDriveService.saveConnection(this.configForm.value)
      .subscribe({
        next: () => {
          this.isConnected = true;
          this.loading = false;
          alert("Configuration Saved Successfully");
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          alert("Save Failed");
        }
      });
  }

  getFiles(): void {
    this.loading = true;
    // Commented out — same as original
  }

  syncData(file: any): void {
    const tableName = prompt("Enter table name");
    if (!tableName || tableName.trim() === "") {
      alert("Table name required");
      return;
    }
    this.loading = true;
    this.oneDriveService.syncData(file.id, tableName.trim())
      .subscribe({
        next: () => {
          this.loading = false;
          alert("File Synced Successfully");
        },
        error: () => {
          this.loading = false;
          alert("Sync Failed");
        }
      });
  }

  downloadFile(file: any): void {
    this.oneDriveService.downloadFile(file.id)
      .subscribe({
        next: (blob: Blob) => {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            console.log("📊 Excel Data from OneDrive:", jsonData);
          };
          reader.readAsArrayBuffer(blob);
        },
        error: (err) => {
          console.error("❌ Download Error:", err);
        }
      });
  }
}
