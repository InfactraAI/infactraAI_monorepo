import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { LogoService } from '../../../core/services/logo.service';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatSnackBarModule],
  templateUrl: './logo-dialog.html',
  styleUrl: './logo-dialog.less',
})
export class LogoDialog implements OnInit {
  selectedFile!: File;
  previewUrl: any = null;

  logoUrl: string = 'assets/images/jayanitha.png';
  companyName: string = '';

  constructor(
    private logoService: LogoService,
    private dialogRef: MatDialogRef<LogoDialog>,
    private snack: MatSnackBar
  ) { }

  ngOnInit() {
    this.getCompany();
  }

  getCompany() {
    this.logoService.getCompany().subscribe((res: any) => {
      this.logoUrl = res.logo;
      this.companyName = res.name;
    });
  }

  onFileSelect(event: any) {
    this.selectedFile = event.target.files[0];
    if (this.selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  uploadLogo() {
    const formData = new FormData();
    formData.append('logo', this.selectedFile);

    this.logoService.uploadLogo(this.selectedFile)
      .subscribe((res: any) => {
        this.logoUrl = res.logo;
        this.previewUrl = null;
        this.snack.open('Logo uploaded successfully', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
      }, (err: any) => {
        this.snack.open('Error uploading logo', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      });
  }

  saveSettings() {
    this.logoService.updateCompany({
      name: this.companyName,
      logo: this.logoUrl
    }).subscribe(() => {
      this.snack.open('Logo saved successfully', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
      this.dialogRef.close({ logoUrl: this.logoUrl });
    });
  }
}
