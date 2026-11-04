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
import { GoogleSheetsConfigComponent } from './features/google-sheets/google-sheets-config';
import { AskAi } from './features/ask-ai/ask-ai';
import { TopNavbar } from './shared/components/navbar/navbar';
import { TeamComponent } from './features/team/team';
import { AcceptInviteComponent } from './features/auth/accept-invite/accept-invite';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'ask', component: AskAi },
  { path: 'accept-invite', component: AcceptInviteComponent },
  {
    path: '',
    component: TopNavbar,
   // canActivate: [authGuard],
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
      { path: 'google-sheets-config', component: GoogleSheetsConfigComponent },
      { path: 'team', component: TeamComponent },
      { path: 'ask-fireai', component: AskAi },
    ],
  },
  { path: '**', component: AdminDashboard },
];