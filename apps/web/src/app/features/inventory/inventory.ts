import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { OneDriveService } from '../../core/services/onedrive.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [MatTableModule, MatIconModule, CommonModule, MatCardModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.less',
})
export class InventoryComponent implements OnInit {
  tableData: any[] = [];
  displayedColumns: string[] = [];
  userId = localStorage.getItem('userId') || '';

  constructor(private onedriveService: OneDriveService) {}

  ngOnInit() { this.loadExcelData(); }

  loadExcelData() {
    this.onedriveService.getExcelInventoryHrData('inventory').subscribe((res: any) => {
      this.tableData = res.data;
      this.displayedColumns = res.columns;
    });
  }

  getInventoryFiles() {
    this.onedriveService.getFiles(this.userId, 'inventory').subscribe({
      next: () => this.loadExcelData(),
    });
  }
}
