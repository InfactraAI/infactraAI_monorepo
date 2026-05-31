import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';

import { LogoDialog } from '../logo-dialog/logo-dialog';
import { LogoService } from '../../../core/services/logo.service';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.less',
})
export class TopNavbar implements OnInit {

  workflowOpen = false;
  activeNav = '';
  logoUrl: string = 'assets/images/jayanitha.png';
  companyName: string = '';
  name: string = localStorage.getItem('username') || '';

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private logoService: LogoService
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects;

        if (url === '/dashboard') {
          this.activeNav = 'dashboard';
        } else if (url.startsWith('/mis')) {
          this.activeNav = 'mis';
          this.workflowOpen = true;
        } else if (url.startsWith('/hr-ai')) {
          this.activeNav = 'hr-ai';
        } else if (url.startsWith('/inventory')) {
          this.activeNav = 'inventory';
        } else if (url.startsWith('/reconciliation')) {
          this.activeNav = 'reconciliation';
        } else if (
          url.startsWith('/configuration') ||
          url.startsWith('/tally-config') ||
          url.startsWith('/one-drive-config')
        ) {
          this.activeNav = 'configuration';
        } else if (url.startsWith('/ask-fireai')) {
          this.activeNav = 'ask-ai';
        }
      });

    this.getCompany();
  }

  getCompany(): void {
    this.logoService.getCompany().subscribe((res: any) => {
      this.logoUrl = res.logo;
      this.companyName = res.name;
    });
  }

  isConfigActive(): boolean {
    return (
      this.router.url.startsWith('/configuration') ||
      this.router.url.startsWith('/tally-config') ||
      this.router.url.startsWith('/one-drive-config')
    );
  }

  setActive(nav: string): void {
    this.activeNav = nav;
  }

  toggleWorkflow(): void {
    this.workflowOpen = !this.workflowOpen;
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  addLogo(): void {
    this.dialog.open(LogoDialog, {
      width: '700px',
      height: '500px'
    }).afterClosed().subscribe((data) => {
      this.logoUrl = data?.logoUrl || this.logoUrl;
    });
  }
}
