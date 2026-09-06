import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './configuration.html',
  styleUrl: './configuration.less',
})
export class Configuration {
  constructor(private router: Router) {}

  tallyConnected = false;
  oneDriveConnected = false;
  googleSheetConnected = false;
  zohoBooksConnected = false;
  bigQueryConnected = false;
  mixpanelConnected = false;
  amazonConnected = false;
  googleAnalyticsConnected = false;
  selectedSource = '';

  selectSource(source: string) { this.selectedSource = source; }

  connectTally()          { this.resetConnections(); this.tallyConnected = true; this.selectedSource = 'Tally'; this.router.navigate(['/tally-config']); }
  connectOneDrive()       { this.resetConnections(); this.oneDriveConnected = true; this.selectedSource = 'OneDrive'; this.router.navigate(['/one-drive-config']); }
  connectGoogleSheet()    { this.resetConnections(); this.googleSheetConnected = true; this.selectedSource = 'Google Sheet'; this.router.navigate(['/google-sheets-config']); }
  connectZohoBooks()      { this.resetConnections(); this.zohoBooksConnected = true; this.selectedSource = 'Zoho Books'; }
  connectBigQuery()       { this.resetConnections(); this.bigQueryConnected = true; this.selectedSource = 'BigQuery'; }
  connectMixpanel()       { this.resetConnections(); this.mixpanelConnected = true; this.selectedSource = 'Mixpanel'; }
  connectAmazon()         { this.resetConnections(); this.amazonConnected = true; this.selectedSource = 'Amazon Seller'; }
  connectGoogleAnalytics(){ this.resetConnections(); this.googleAnalyticsConnected = true; this.selectedSource = 'Google Analytics'; }

  resetConnections() {
    this.tallyConnected = this.oneDriveConnected = this.googleSheetConnected =
    this.zohoBooksConnected = this.bigQueryConnected = this.mixpanelConnected =
    this.amazonConnected = this.googleAnalyticsConnected = false;
  }
}
