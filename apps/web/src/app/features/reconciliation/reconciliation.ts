import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reconciliation.html',
  styleUrl: './reconciliation.less',
})
export class ReconciliationComponent {
  displayedNcaColumns = ['particulars', 'mar25'];

  netCurrentAssetsData = [
    { particulars: 'Bank Balance', mar25: 1.60 },
    { particulars: 'Stock', mar25: 5.25 },
    { particulars: 'Sundry Debtors', mar25: 18.30 },
    { particulars: 'GST Refund', mar25: 2.76 },
    { particulars: 'Advances', mar25: 1.54 },
    { particulars: 'Mutual Fund', mar25: 1.00 },
    { particulars: 'Duty Drawback', mar25: 0.19 },
    { particulars: 'JEPL 2400 FD Ag Sidbi loan', mar25: 1.00 },
    { particulars: 'JEPL 2200 receivable Ag Sidbi loan', mar25: 1.00 },
    { particulars: 'JAYANITA payables', mar25: -0.83 },
    { particulars: 'Sundry Creditors', mar25: -10.22 },
    { particulars: 'Limits Used - BILL Disc', mar25: -4.44 },
    { particulars: 'Limits Used - OD', mar25: -1.95 },
    { particulars: 'SIDBI Loan', mar25: -1.85 },
    { particulars: 'PC Loan', mar25: -3.07 },
    { particulars: 'Advances Payment', mar25: 0.08 },
    { particulars: 'Self assessment tax', mar25: 0.00 },
    { particulars: 'Net Current Asset', mar25: 10.36, total: true },
  ];
}
