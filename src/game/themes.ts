// Freischaltbare Farbwelten (Münzen-Sink). Ändern die Tönung des Hintergrunds
// + die Akzentfarbe.
//
// ⚠ `--felt`/`--felt-2` werden seit dem 11.08.2026 NIRGENDS mehr gemalt: Mit dem
// Tempel-Hintergrund auf allen Bildschirmen sind `.board-wrap` und `.m4`
// durchlässig geworden. Ohne Ersatz hätte der Shop einen Abschnitt „Hintergrund"
// verkauft, der nichts mehr bewirkt. Deshalb `--wash`: eine Farbschicht ÜBER dem
// Tempelfoto (in styles.css Teil des html-Hintergrunds).
//
// `classic` ist bewusst `transparent` — der Standardzustand soll aussehen wie
// das freigegebene Original, ohne Tönung. Die bezahlten Welten färben spürbar.
// Die Werte sind `--felt-2` als rgba; wer eine Welt ändert, muss beides
// nachziehen, sonst passen Vorschau-Farbfleck und Wirkung nicht mehr zusammen.

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
    vars: { '--felt': '#0b3d2e', '--felt-2': '#0f4a37', '--wash': 'transparent', '--accent': '#35a06d' },
  },
  {
    id: 'midnight',
    label: 'theme.midnight',
    cost: 300,
    swatch: '#1c2b4a',
    vars: { '--felt': '#0e1730', '--felt-2': '#1c2b4a', '--wash': 'rgba(28, 43, 74, 0.34)', '--accent': '#5ea0ff' },
  },
  {
    id: 'sakura',
    label: 'theme.sakura',
    cost: 500,
    swatch: '#7d2b4e',
    vars: { '--felt': '#4a1230', '--felt-2': '#7d2b4e', '--wash': 'rgba(125, 43, 78, 0.34)', '--accent': '#ff9ec7' },
  },
  {
    id: 'sunset',
    label: 'theme.sunset',
    cost: 500,
    swatch: '#8a3b1e',
    vars: { '--felt': '#5a1e12', '--felt-2': '#8a3b1e', '--wash': 'rgba(138, 59, 30, 0.34)', '--accent': '#ffb347' },
  },
  {
    id: 'jade',
    label: 'theme.jade',
    cost: 800,
    swatch: '#0d5b57',
    vars: { '--felt': '#083b39', '--felt-2': '#0d5b57', '--wash': 'rgba(13, 91, 87, 0.34)', '--accent': '#4fe0c0' },
  },
  // Asia-Serie (13.7.2026): Lack & Gold, Seidenpapier, Lampion-Nacht
  {
    id: 'lackrot',
    label: 'theme.lackrot',
    cost: 900,
    swatch: '#6e1f16',
    vars: { '--felt': '#3f100c', '--felt-2': '#6e1f16', '--wash': 'rgba(110, 31, 22, 0.34)', '--accent': '#e6b74a' },
  },
  {
    id: 'seide',
    label: 'theme.seide',
    cost: 800,
    swatch: '#6e6248',
    vars: { '--felt': '#453d2e', '--felt-2': '#6e6248', '--wash': 'rgba(110, 98, 72, 0.34)', '--accent': '#d9c9a3' },
  },
  {
    id: 'lampion',
    label: 'theme.lampion',
    cost: 1000,
    swatch: '#232752',
    vars: { '--felt': '#14162e', '--felt-2': '#232752', '--wash': 'rgba(35, 39, 82, 0.34)', '--accent': '#ff9d4d' },
  },
];

// --- Stein-Designs (Skins) --------------------------------------------------
// Wirken global über ein data-skin-Attribut auf <html> (CSS in styles.css),
// damit sie überall greifen, wo <Tile> gerendert wird (Board, Table4, Modi).

export interface TileSkin {
  id: string;
  label: string;
  cost: number;
  swatch: string;
}

export const TILE_SKINS: TileSkin[] = [
  { id: 'ivory', label: 'skin.ivory', cost: 0, swatch: '#f4ecd8' },
  { id: 'sakura', label: 'skin.sakura', cost: 400, swatch: '#f6b8cf' },
  { id: 'minimal', label: 'skin.minimal', cost: 500, swatch: '#dfe7ee' },
  { id: 'neon', label: 'skin.neon', cost: 700, swatch: '#12203a' },
  { id: 'contrast', label: 'skin.contrast', cost: 300, swatch: '#111111' },
];

export function getSkin(id: string): TileSkin {
  return TILE_SKINS.find((s) => s.id === id) ?? TILE_SKINS[0];
}

export function applySkin(id: string) {
  document.documentElement.setAttribute('data-skin', getSkin(id).id);
}

// CSS-Filter je Skin – für die Vorschau-Kacheln im Design-Screen (unabhängig
// vom global gesetzten data-skin). Muss zu den Regeln in styles.css passen.
export const SKIN_FILTER: Record<string, string> = {
  ivory: 'none',
  sakura: 'saturate(1.35) hue-rotate(-30deg) brightness(1.03)',
  minimal: 'saturate(0.6) contrast(1.2)',
  neon: 'contrast(1.15) saturate(1.6) drop-shadow(0 0 4px rgba(94,160,255,0.7))',
  contrast: 'contrast(1.7) saturate(1.5) brightness(1.05)',
};

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
}
