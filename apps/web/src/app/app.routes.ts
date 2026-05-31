import { Routes } from '@angular/router';

import { login as LoginComponent } from './features/auth/login';
import { AdminDashboard } from './features/dashboard/dashboard';
import { MisComponent } from './features/mis/mis';
import { Configuration } from './features/configuration/configuration';
import { OneDriveConfigComponent } from './features/onedrive/onedrive-config';
import { ReconciliationComponent } from './features/reconciliation/reconciliation';
import { InventoryComponent } from './features/inventory/inventory';
import { HrAiComponent } from './features/hr/hr';
import { AttendanceComponent } from './features/hr/attendance/attendance-sheet';
import { SalarySheetComponent } from './features/hr/salary/salary-sheet';
import { Tally } from './features/tally/tally';
import { AskAi } from './features/ask-ai/ask-ai';
import { TopNavbar } from './shared/components/navbar/navbar';

export const routes: Routes = [
  { path: 'ask', component: AskAi },
  {
    path: '',
    component: TopNavbar,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboard },
      { path: 'mis', component: MisComponent },
      { path: 'inventory', component: InventoryComponent },
      {
        path: 'hr-ai',
        component: HrAiComponent,
        children: [
          { path: '', redirectTo: 'attendance', pathMatch: 'full' },
          { path: 'attendance', component: AttendanceComponent },
          { path: 'salary', component: SalarySheetComponent },
        ],
      },
      { path: 'reconciliation', component: ReconciliationComponent },
      { path: 'configuration', component: Configuration },
      { path: 'tally-config', component: Tally },
      { path: 'one-drive-config', component: OneDriveConfigComponent },
      { path: 'ask-fireai', component: AskAi },
    ],
  },
  { path: '**', component: LoginComponent },
];
