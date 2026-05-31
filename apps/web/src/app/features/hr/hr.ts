import { Component, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { OneDriveService } from '../../core/services/onedrive.service';

@Component({
  selector: 'app-hr-ai',
  standalone: true,
  imports: [
    MatTableModule,
    RouterLink,
    RouterOutlet,
    RouterLinkActive,
    FormsModule
  ],
  templateUrl: './hr.html',
  styleUrl: './hr.less',
})
export class HrAiComponent implements OnInit {
  selectedDate: string = '';
  userId: string = localStorage.getItem('userId') || '';

  constructor(private onedriveService: OneDriveService) { }

  ngOnInit() {
    this.setDefaultDate();
    this.getHrFiles();
  }

  setDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
  }

  onDateChange(event: any) {
    console.log("New date selected:", this.selectedDate);
  }

  getHrFiles() {
    this.onedriveService.getFiles(this.userId, 'hr').subscribe({
      next: (res) => {
        this.loadExcelData();
        console.log("📁 HR OneDrive Files:", res);
      }
    });
  }

  loadExcelData() {
    this.onedriveService.getExcelInventoryHrData('hr').subscribe((res: any) => {
      // this.tableData = res.data;
      // this.displayedColumns = res.columns;
    });
  }
}
