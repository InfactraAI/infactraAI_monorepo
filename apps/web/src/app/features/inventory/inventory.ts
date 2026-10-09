import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { OneDriveService } from '../../core/services/onedrive.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.less',
})
export class InventoryComponent implements OnInit {
  tableData: any[] = [];
  displayedColumns: string[] = [];

  constructor(private onedriveService: OneDriveService) {}

  ngOnInit() { this.loadExcelData(); }

  loadExcelData() {
    this.onedriveService.getExcelInventoryHrData('inventory').subscribe((res: any) => {
      this.tableData = res.data;
      this.displayedColumns = res.columns;
    });
  }

  /** Right-align numeric cells so columns of figures line up. */
  isNumeric(v: unknown): boolean {
    if (v === null || v === undefined || v === '') return false;
    return !isNaN(Number(String(v).replace(/[,\s₹$]/g, '')));
  }

  getInventoryFiles() {
    this.onedriveService.getFiles('inventory').subscribe({
      next: () => this.loadExcelData(),
    });
  }
}
