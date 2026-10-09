import { Component, OnInit, effect } from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';
import { verticalHoverPlugin } from '../../shared/plugins/chart-plugin';
import { OneDriveService } from '../../core/services/onedrive.service';
import { ThemeService } from '../../core/services/theme.service';

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
  imports: [CommonModule, BaseChartDirective, MatIconModule],
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
        backgroundColor: '#1a7f43',
        borderRadius: 1,
        barThickness: 8,
      },
      {
        label: 'Net',
        data: [25, 15, 30, 12, 15, 10, 18, 8, 5, 22, 9, 11, 14],
        backgroundColor: '#0033a0',
        borderRadius: 1,
        barThickness: 8,
      },
      {
        label: 'Outflow',
        data: [90, 110, 95, 75, 105, 88, 115, 100, 120, 110, 85, 98, 105],
        backgroundColor: '#c0281c',
        borderRadius: 1,
        barThickness: 8,
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
        grid: { color: '#f0f0f0' },
        ticks: {
          stepSize: 70,
          callback: (value) => value === 0 ? '0' : `${value}K`,
          color: '#9b9b9b',
          font: { size: 10 }
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#9b9b9b',
          font: { size: 10, family: 'Inter' }
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
          font: { size: 12, family: 'Inter' }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#ffffff',
        borderColor: '#e4e4e4',
        borderWidth: 1,
        titleColor: '#0a0a0a',
        bodyColor: '#0a0a0a',
        cornerRadius: 4,
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
            if (label === 'Inflow')  return '#1a7f43';
            if (label === 'Outflow') return '#c0281c';
            if (label === 'Net')     return '#0033a0';
            return '#0a0a0a';
          }
        }
      }
    }
  };

  constructor(private onedriveService: OneDriveService, private theme: ThemeService) {
    // Chart.js paints to canvas, so CSS variables cannot reach it. Re-read the
    // tokens whenever the theme changes and hand Chart.js fresh objects.
    effect(() => { this.theme.current(); this.paintChart(); });
  }

  private paintChart(): void {
    const t = (n: string) => this.theme.token(n);
    const [inflow, net, outflow] = [t('--gain'), t('--accent'), t('--loss')];

    this.barChartData = {
      ...this.barChartData,
      datasets: this.barChartData.datasets.map((d, i) => ({
        ...d, backgroundColor: [inflow, net, outflow][i],
      })),
    };

    // The options carry callbacks, so structuredClone would throw. Spread only
    // the levels we touch and hand Chart.js a new reference.
    const b: any = this.barChartOptions;
    const labelColor = { Inflow: inflow, Outflow: outflow, Net: net } as Record<string, string>;
    this.barChartOptions = {
      ...b,
      animation: false,
      scales: {
        ...b.scales,
        y: { ...b.scales.y, grid: { ...b.scales.y.grid, color: t('--rule-2') }, ticks: { ...b.scales.y.ticks, color: t('--ink-4') } },
        x: { ...b.scales.x, ticks: { ...b.scales.x.ticks, color: t('--ink-4') } },
      },
      plugins: {
        ...b.plugins,
        legend: { ...b.plugins.legend, labels: { ...b.plugins.legend.labels, color: t('--ink-3') } },
        tooltip: {
          ...b.plugins.tooltip,
          backgroundColor: t('--surface'), borderColor: t('--rule'),
          titleColor: t('--ink'), bodyColor: t('--ink'),
          callbacks: { ...b.plugins.tooltip.callbacks, labelTextColor: (ctx: any) => labelColor[ctx.dataset.label] ?? t('--ink') },
        },
      },
    };
  }

  ngOnInit() {
    this.onedriveService.getOneDrives().subscribe({
      next: (res) => {
        res.oneDrives.forEach((drive: any) => {
          if (drive.department === 'inventory') localStorage.setItem('activeInventoryDrive', drive.accountId);
          if (drive.department === 'hr')        localStorage.setItem('activeHRDrive', drive.accountId);
        });
      }
    });
  }
}
