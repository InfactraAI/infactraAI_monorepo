import { Injectable, signal } from '@angular/core';

export interface ThemeOption {
  key: string;
  name: string;
  group: 'Cool' | 'Warm' | 'Neutral' | 'Dark rail' | 'Dark';
  /** Swatch colours for the picker: brand, page ground, sidebar. */
  swatch: [string, string, string];
}

/** Must match the .theme(...) definitions in styles/_themes.less. */
export const THEMES: ThemeOption[] = [
  { key: 'cobalt',     name: 'Cobalt',      group: 'Cool',      swatch: ['#0033a0', '#f3f5f9', '#f3f5f9'] },
  { key: 'arctic',     name: 'Arctic',      group: 'Cool',      swatch: ['#0369a1', '#eef4f8', '#eef4f8'] },
  { key: 'cerulean',   name: 'Cerulean',    group: 'Cool',      swatch: ['#1d4ed8', '#f2f7fb', '#f2f7fb'] },
  { key: 'indigo',     name: 'Indigo',      group: 'Cool',      swatch: ['#4338ca', '#f5f5fb', '#f5f5fb'] },
  { key: 'lagoon',     name: 'Lagoon',      group: 'Cool',      swatch: ['#0f766e', '#eff7f6', '#eff7f6'] },
  { key: 'amber',      name: 'Amber',       group: 'Warm',      swatch: ['#b45309', '#f7f5f1', '#f7f5f1'] },
  { key: 'terracotta', name: 'Terracotta',  group: 'Warm',      swatch: ['#9a3412', '#faf5f0', '#faf5f0'] },
  { key: 'saffron',    name: 'Saffron',     group: 'Warm',      swatch: ['#a16207', '#fbf7ee', '#fbf7ee'] },
  { key: 'olive',      name: 'Olive',       group: 'Warm',      swatch: ['#4d7c0f', '#f5f6f0', '#f5f6f0'] },
  { key: 'ember',      name: 'Ember',       group: 'Warm',      swatch: ['#7a1f3d', '#f8f5f4', '#f8f5f4'] },
  { key: 'rosewood',   name: 'Rosewood',    group: 'Warm',      swatch: ['#9f1239', '#faf4f5', '#faf4f5'] },
  { key: 'aubergine',  name: 'Aubergine',   group: 'Warm',      swatch: ['#6b21a8', '#f6f3f8', '#f6f3f8'] },
  { key: 'ink',        name: 'Ink',         group: 'Neutral',   swatch: ['#0a0a0a', '#f5f5f5', '#f5f5f5'] },
  { key: 'paper',      name: 'Paper',       group: 'Neutral',   swatch: ['#1f1b16', '#f4f1ea', '#f4f1ea'] },
  { key: 'steel',      name: 'Steel',       group: 'Neutral',   swatch: ['#334155', '#eef0f3', '#eef0f3'] },
  { key: 'midnight',   name: 'Midnight',    group: 'Dark rail', swatch: ['#2457d6', '#f3f5f9', '#0b1f44'] },
  { key: 'onyx',       name: 'Onyx',        group: 'Dark rail', swatch: ['#b45309', '#f7f5f1', '#141414'] },
  { key: 'evergreen',  name: 'Evergreen',   group: 'Dark rail', swatch: ['#0f766e', '#eff7f6', '#0b2e2a'] },
  { key: 'slate',      name: 'Slate',       group: 'Dark',      swatch: ['#5b8def', '#0f1419', '#0f1419'] },
  { key: 'carbon',     name: 'Carbon',      group: 'Dark',      swatch: ['#f59e0b', '#0c0c0d', '#0c0c0d'] },
];

const STORAGE_KEY = 'infactra-theme';
const DEFAULT = 'cobalt';

/**
 * Applies a theme by setting data-theme on <html>; styles/_themes.less does
 * the rest. Components that paint outside CSS (the chart) subscribe to
 * `current` and re-read the tokens.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes = THEMES;
  readonly current = signal<string>(DEFAULT);

  constructor() {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    this.apply(saved && THEMES.some((t) => t.key === saved) ? saved : DEFAULT, false);
  }

  apply(key: string, persist = true): void {
    document.documentElement.dataset['theme'] = key;
    this.current.set(key);
    if (persist) { try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ } }
  }

  /** Resolved value of a CSS token under the active theme, e.g. token('--gain'). */
  token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
}
