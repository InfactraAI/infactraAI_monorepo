import { Component } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/services/theme.service';
import { ThemeSwitcher } from './shared/components/theme-switcher/theme-switcher';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeSwitcher],
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  // ThemeService applies the remembered theme in its constructor; injecting
  // it here is what makes that happen before first paint.
  constructor(private matIconRegistry: MatIconRegistry, private sanitizer: DomSanitizer, _theme: ThemeService) {
    this.matIconRegistry.addSvgIconSet(
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/icons.svg')
    );
  }
}
