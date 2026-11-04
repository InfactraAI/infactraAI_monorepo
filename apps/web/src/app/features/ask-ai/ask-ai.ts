import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChartPayload {
  type: ChartType;
  data: ChartConfiguration['data'];
  options: ChartConfiguration['options'];
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  chart?: ChartPayload;
  table?: { columns: string[]; rows: string[][] };
  timestamp: Date;
}

// ── Intent patterns ──────────────────────────────────────────────────────────

const INTENTS: Array<{ pattern: RegExp; handler: string }> = [
  { pattern: /(\d+)\s*day[s]?\s*(sales|revenue|data)/i,        handler: 'nDaySales'   },
  { pattern: /(seven|7)\s*day[s]?\s*(sales|revenue|data)/i,    handler: 'nDaySales'   },
  { pattern: /(last\s+week|weekly)\s*(sales|revenue|data)?/i,  handler: 'nDaySales'   },
  { pattern: /monthly\s*(sales|revenue|trend)/i,               handler: 'monthlySales' },
  { pattern: /top\s*(\d+)?\s*product[s]?/i,                    handler: 'topProducts'  },
  { pattern: /expense[s]?\s*(breakdown|split|category)?/i,     handler: 'expenses'     },
  { pattern: /profit\s*(margin|trend)?/i,                       handler: 'profit'       },
  { pattern: /cash\s*flow/i,                                    handler: 'cashFlow'     },
  { pattern: /inventory\s*(status|level|stock)?/i,             handler: 'inventory'    },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });
}

const BLUE   = 'rgba(37,99,235,0.85)';
const GREEN  = 'rgba(16,185,129,0.85)';
const ORANGE = 'rgba(245,158,11,0.85)';
const RED    = 'rgba(239,68,68,0.85)';
const PURPLE = 'rgba(139,92,246,0.85)';
const TEAL   = 'rgba(20,184,166,0.85)';

const baseOpts = (title: string): ChartConfiguration['options'] => ({
  responsive: true,
  plugins: { legend: { display: true }, title: { display: true, text: title, font: { size: 14 } } },
  scales: { y: { beginAtZero: true } },
});

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-fire-ai-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './ask-ai.html',
  styleUrls: ['./ask-ai.less'],
})
export class AskAi implements AfterViewChecked {
  @ViewChild('chatBox') chatBox!: ElementRef<HTMLDivElement>;

  userName     = localStorage.getItem('username') || 'User';
  question     = '';
  showUpgradeCard = true;
  showDropdown    = false;
  isTyping        = false;
  messages: Message[] = [];

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  ngAfterViewChecked() {
    if (this.chatBox) {
      const el = this.chatBox.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  askQuestion() {
    const q = this.question.trim();
    if (!q) return;

    this.messages.push({ role: 'user', text: q, timestamp: new Date() });
    this.question = '';
    this.isTyping = true;

    setTimeout(() => {
      this.isTyping = false;
      this.messages.push(this.buildResponse(q));
    }, 700);
  }

  onEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.askQuestion();
    }
  }

  // ── Intent routing ────────────────────────────────────────────────────────

  private buildResponse(q: string): Message {
    for (const intent of INTENTS) {
      const m = q.match(intent.pattern);
      if (m) return (this as any)[intent.handler](q, m);
    }
    return { role: 'ai', text: `I don't have a data source wired for that yet. Try asking:\n• "7 days sales data"\n• "monthly revenue trend"\n• "top 5 products"\n• "expenses breakdown"\n• "profit margin"\n• "cash flow"\n• "inventory status"`, timestamp: new Date() };
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  private nDaySales(q: string, m: RegExpMatchArray): Message {
    const n = parseInt(m[1]) || 7;
    const days  = lastNDays(n);
    const sales = days.map(() => rand(80_000, 4_50_000));
    const total = sales.reduce((a, b) => a + b, 0);
    const avg   = Math.round(total / n);

    return {
      role: 'ai',
      text: `Here's the **last ${n} days sales data**.\nTotal: AED${total.toLocaleString('en-IN')} | Avg/day: AED${avg.toLocaleString('en-IN')}`,
      chart: {
        type: 'bar',
        data: {
          labels: days,
          datasets: [{ label: 'Sales (AED)', data: sales, backgroundColor: BLUE, borderRadius: 6 }],
        },
        options: baseOpts(`Last ${n} Days — Sales`),
      },
      timestamp: new Date(),
    };
  }

  private monthlySales(): Message {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const rev  = months.map(() => rand(8_00_000, 35_00_000));
    const prev = months.map(() => rand(6_00_000, 30_00_000));

    return {
      role: 'ai',
      text: 'Here is the **monthly revenue trend** for the current financial year (FY 2025-26).',
      chart: {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'This Year (AED)', data: rev,  borderColor: BLUE,  backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.4 },
            { label: 'Last Year (AED)', data: prev, borderColor: GREEN, backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
          ],
        },
        options: baseOpts('Monthly Revenue — FY 2025-26'),
      },
      timestamp: new Date(),
    };
  }

  private topProducts(_q: string, m: RegExpMatchArray): Message {
    const n = parseInt(m[1]) || 5;
    const products = ['Basmati Rice 25kg', 'Toor Dal 50kg', 'Wheat Flour 30kg', 'Mustard Oil 15L', 'Sugar 50kg', 'Salt 25kg', 'Chana Dal 50kg'];
    const top = products.slice(0, n);
    const vals = top.map(() => rand(1_50_000, 12_00_000));
    const colors = [BLUE, GREEN, ORANGE, PURPLE, TEAL, RED, BLUE];

    return {
      role: 'ai',
      text: `Top **${n} products** by sales revenue this month.`,
      chart: {
        type: 'bar',
        data: {
          labels: top,
          datasets: [{ label: 'Revenue (AED)', data: vals, backgroundColor: colors.slice(0, n), borderRadius: 6 }],
        },
        options: { ...baseOpts(`Top ${n} Products by Revenue`), indexAxis: 'y' as any },
      },
      timestamp: new Date(),
    };
  }

  private expenses(): Message {
    const cats = ['Raw Material', 'Salaries', 'Logistics', 'Rent & Utilities', 'Marketing', 'Misc'];
    const vals  = [rand(40,55), rand(18,25), rand(8,14), rand(5,10), rand(3,8), rand(2,5)];

    return {
      role: 'ai',
      text: 'Here is the **expenses breakdown** for this month across all cost categories.',
      chart: {
        type: 'doughnut',
        data: {
          labels: cats,
          datasets: [{ data: vals, backgroundColor: [BLUE, GREEN, ORANGE, PURPLE, TEAL, RED], hoverOffset: 6 }],
        },
        options: { responsive: true, plugins: { legend: { position: 'right' }, title: { display: true, text: 'Expense Breakdown (%)' } } },
      },
      timestamp: new Date(),
    };
  }

  private profit(): Message {
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const gross = months.map(() => rand(12, 22));
    const net   = gross.map(g => g - rand(4, 8));

    return {
      role: 'ai',
      text: 'Here is the **profit margin trend** (%) for the last 6 months.',
      chart: {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'Gross Margin (%)', data: gross, borderColor: GREEN,  backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
            { label: 'Net Margin (%)',   data: net,   borderColor: BLUE,   backgroundColor: 'rgba(37,99,235,0.1)',  fill: true, tension: 0.4 },
          ],
        },
        options: baseOpts('Profit Margin Trend — Last 6 Months'),
      },
      timestamp: new Date(),
    };
  }

  private cashFlow(): Message {
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
    const inflow  = weeks.map(() => rand(5_00_000, 18_00_000));
    const outflow = weeks.map(() => rand(4_00_000, 15_00_000));
    const net     = inflow.map((v, i) => v - outflow[i]);

    return {
      role: 'ai',
      text: 'Here is the **cash flow** for the last 8 weeks — inflow, outflow, and net position.',
      chart: {
        type: 'bar',
        data: {
          labels: weeks,
          datasets: [
            { label: 'Inflow (AED)',  data: inflow,  backgroundColor: GREEN,  borderRadius: 4 },
            { label: 'Outflow (AED)', data: outflow, backgroundColor: RED,    borderRadius: 4 },
            { label: 'Net (AED)',     data: net,      backgroundColor: ORANGE, borderRadius: 4, type: 'line' as any, borderColor: ORANGE, fill: false },
          ],
        },
        options: baseOpts('Cash Flow — Last 8 Weeks'),
      },
      timestamp: new Date(),
    };
  }

  private inventory(): Message {
    const items = ['Basmati Rice', 'Toor Dal', 'Wheat Flour', 'Mustard Oil', 'Sugar'];
    const stock    = items.map(() => rand(20, 200));
    const reorder  = items.map(() => 50);

    return {
      role: 'ai',
      text: 'Here is the current **inventory status**. Items below the reorder line need restocking.',
      chart: {
        type: 'bar',
        data: {
          labels: items,
          datasets: [
            { label: 'Stock (units)',    data: stock,   backgroundColor: stock.map(s => s < 50 ? RED : BLUE), borderRadius: 6 },
            { label: 'Reorder level',   data: reorder, backgroundColor: 'transparent', borderColor: ORANGE, type: 'line' as any, borderDash: [6, 4], borderWidth: 2 },
          ],
        },
        options: baseOpts('Inventory Status'),
      },
      timestamp: new Date(),
    };
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  closeUpgradeCard() { this.showUpgradeCard = false; }
  toggleDropdown()   { this.showDropdown = !this.showDropdown; }
  closeDropdown()    { this.showDropdown = false; }

  quickAsk(prompt: string) {
    this.question = prompt;
    this.askQuestion();
  }

  formatText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
