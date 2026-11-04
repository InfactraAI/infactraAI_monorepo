import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type ActiveTab = 'pl' | 'plNotes' | 'additional' | 'hr';

@Component({
  selector: 'app-mis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis.html',
  styleUrls: ['./mis.less'],
})
export class MisComponent {
  activeTab: ActiveTab = 'pl';

  tabs = [
    { key: 'pl', label: 'P&L' },
    { key: 'plNotes', label: 'P&L Notes' },
    { key: 'additional', label: 'Additional Notes & Ratios' },
    { key: 'hr', label: 'HR Data' },
  ];

  kpis = [
    { label: 'Net Profit', value: 'AED4,24,404', trend: '↑ 97% MAR-26', color: '#6366f1', icon: 'ti-trending-up' },
    { label: 'Gross Profit', value: 'AED4,25,504', trend: '↑ 98% MAR-26', color: '#10b981', icon: 'ti-coin' },
    { label: 'EBITDA', value: 'AED4,24,604', trend: '↑ 97% MAR-26', color: '#f59e0b', icon: 'ti-report-analytics' },
    { label: 'APR Net', value: '-AED30,241', trend: '↓ -727% APR-26', color: '#ef4444', icon: 'ti-trending-down', isNegative: true },
  ];

  plRows = [
    { particular: 'Net Profit', mar: '4,24,404', marRatio: '97%', apr: '-30,241', aprRatio: '-727%', may: '1,97,361', mayRatio: '4744%', isTotal: true, aprNegative: true },
    { particular: 'Direct Income', isSection: true },
    { particular: 'Ikea', mar: '1,000', apr: '1,000', may: '1,000' },
    { particular: 'Direct Expenses', isSection: true },
    { particular: 'Raw Material', mar: '1,20,000', apr: '45,000', may: '28,000' },
  ];

  setActiveTab(tab: ActiveTab) { this.activeTab = tab; }
}
