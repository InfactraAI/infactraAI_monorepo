import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ThemeService, ThemeOption } from '../../../core/services/theme.service';

/** Floating theme picker for design review. Remove or gate once a theme is chosen. */
@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './theme-switcher.html',
  styleUrl: './theme-switcher.less',
})
export class ThemeSwitcher {
  open = signal(false);
  groups: ThemeOption['group'][] = ['Cool', 'Warm', 'Neutral', 'Dark rail', 'Dark'];

  constructor(public theme: ThemeService) {}

  currentName = computed(() => this.theme.themes.find((t) => t.key === this.theme.current())?.name ?? '');

  inGroup(g: ThemeOption['group']): ThemeOption[] {
    return this.theme.themes.filter((t) => t.group === g);
  }

  pick(key: string): void { this.theme.apply(key); }
  toggle(): void { this.open.update((v) => !v); }
}
