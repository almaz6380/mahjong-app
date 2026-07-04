// Freischaltbare Farbwelten (Münzen-Sink). Ändern Filz-Hintergrund + Akzent.

export interface Theme {
  id: string;
  label: string;
  cost: number;
  vars: Record<string, string>; // CSS-Variablen, die auf :root gesetzt werden
  swatch: string; // Vorschaufarbe im Shop
}

export const THEMES: Theme[] = [
  {
    id: 'classic',
    label: 'theme.classic',
    cost: 0,
    swatch: '#0f4a37',
    vars: { '--felt': '#0b3d2e', '--felt-2': '#0f4a37', '--accent': '#f5b301' },
  },
  {
    id: 'midnight',
    label: 'theme.midnight',
    cost: 300,
    swatch: '#1c2b4a',
    vars: { '--felt': '#0e1730', '--felt-2': '#1c2b4a', '--accent': '#5ea0ff' },
  },
  {
    id: 'sakura',
    label: 'theme.sakura',
    cost: 500,
    swatch: '#7d2b4e',
    vars: { '--felt': '#4a1230', '--felt-2': '#7d2b4e', '--accent': '#ff9ec7' },
  },
  {
    id: 'sunset',
    label: 'theme.sunset',
    cost: 500,
    swatch: '#8a3b1e',
    vars: { '--felt': '#5a1e12', '--felt-2': '#8a3b1e', '--accent': '#ffb347' },
  },
  {
    id: 'jade',
    label: 'theme.jade',
    cost: 800,
    swatch: '#0d5b57',
    vars: { '--felt': '#083b39', '--felt-2': '#0d5b57', '--accent': '#4fe0c0' },
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
}
