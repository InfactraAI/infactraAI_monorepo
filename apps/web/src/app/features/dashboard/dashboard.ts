import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartType,
  ChartConfiguration,
  BarController
} from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { verticalHoverPlugin } from '../../shared/plugins/chart-plugin';
import { OneDriveService } from '../../core/services/onedrive.service';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  verticalHoverPlugin,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
  ],
  providers: [provideCharts()],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.less']
})
export class AdminDashboard implements OnInit {

  upcomingPayables = [
    { name: 'Office Supplies Inc.',  poNumber: 'PO-2023-187', dueIn: 2, amount: 3200  },
    { name: 'Cloud Services Ltd.',   poNumber: 'PO-2023-192', dueIn: 3, amount: 15000 },
    { name: 'Marketing Partners',    poNumber: 'PO-2023-195', dueIn: 4, amount: 8750  },
    { name: 'IT Infrastructure Co.', poNumber: 'PO-2023-198', dueIn: 5, amount: 22000 },
    { name: 'Business Insurance',    poNumber: 'PO-2023-203', dueIn: 7, amount: 12500 }
  ];

  snapshotCards = [
    { title: 'Net Profit',   value: '₹ 4.25 Cr',  change: '3.2%',  subtitle: ' vs yesterday',  color: 'blue',   icon: 'attach_money'   },
    { title: 'Cash Profit',  value: '37 weeks',    change: '+2 wks', subtitle: ' vs last month', color: 'green',  icon: 'calendar_today' },
    { title: 'EBIDTA',       value: '₹ 73.50 L',  change: '8.5%',  subtitle: ' vs last week',  color: 'orange', icon: 'error_outline'  },
    { title: 'Gross Profit', value: '₹ 61.45 L',  change: '12.3%', subtitle: ' vs last week',  color: 'purple', icon: 'email'          },
    { title: 'Sales',        value: '₹ 18,20,000', change: '5.1%', subtitle: 'vs last week',   color: 'teal',   icon: 'payments'       },
    { title: 'Receivables',  value: '₹ 12,80,000', change: '2.4%', subtitle: 'vs last week',   color: 'pink',   icon: 'credit_card'    },
    { title: 'Purchase',     value: '₹ 12,467',   change: '9%',    subtitle: 'vs last month',  color: 'indigo', icon: 'description'    },
    { title: 'Payables',     value: '₹ 96,990/mo', change: '1.2%', subtitle: 'vs last month',  color: 'lime',   icon: 'currency_rupee' }
  ];

  barChartType: ChartType = 'bar';

  barChartData: ChartConfiguration['data'] = {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13'],
    datasets: [
      {
        label: 'Inflow',
        data: [120, 95, 130, 85, 110, 78, 125, 98, 112, 140, 90, 115, 122],
        backgroundColor: '#99f6e4',
        borderRadius: 4,
        barThickness: 10,
      },
      {
        label: 'Net',
        data: [25, 15, 30, 12, 15, 10, 18, 8, 5, 22, 9, 11, 14],
        backgroundColor: '#c7d2fe',
        borderRadius: 4,
        barThickness: 10,
      },
      {
        label: 'Outflow',
        data: [90, 110, 95, 75, 105, 88, 115, 100, 120, 110, 85, 98, 105],
        backgroundColor: '#fecaca',
        borderRadius: 4,
        barThickness: 10,
      }
    ]
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20, bottom: 0 } },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: '#f1f5f9' },
        ticks: {
          stepSize: 70,
          callback: (value) => value === 0 ? '0' : `${value}K`,
          color: '#94a3b8',
          font: { size: 10 }
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 10, family: 'Plus Jakarta Sans' }
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        align: 'start',
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 8,
          padding: 20,
          font: { size: 12, family: 'Plus Jakarta Sans' }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#ffffff',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        titleColor: '#111827',
        bodyColor: '#111827',
        cornerRadius: 8,
        padding: 14,
        displayColors: true,
        titleFont: { size: 14, weight: 600 },
        bodyFont: { size: 13 },
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            const label = context.dataset.label || '';
            return `${label}: ₹${Math.abs(value).toLocaleString()}`;
          },
          labelTextColor: (context) => {
            const label = context.dataset.label;
            if (label === 'Inflow')  return '#0d9488';
            if (label === 'Outflow') return '#e11d48';
            if (label === 'Net')     return '#4f46e5';
            return '#111827';
          }
        }
      }
    }
  };

  userId = localStorage.getItem('userId') || '';
  constructor(private onedriveService: OneDriveService) {}

  ngOnInit() {
    this.onedriveService.getOneDrives(this.userId).subscribe({
      next: (res) => {
        res.oneDrives.forEach((drive: any) => {
          if (drive.department === 'inventory') localStorage.setItem('activeInventoryDrive', drive.accountId);
          if (drive.department === 'hr')        localStorage.setItem('activeHRDrive', drive.accountId);
        });
      }
    });
  }
}
