// Freischaltbare Farbwelten (Münzen-Sink). Ändern die Tönung des Tempelfotos
// + die Akzentfarbe.
//
// Wirkung: `--wash` (unten) und `--wash-top` (oben) ergeben einen Verlauf ÜBER
// dem Tempelfoto (styles.css, mittlere Lage des html-Hintergrunds). Seit 1.6.0
// mit zwei Farben je Welt statt einer pauschalen 34-%-Fläche — vorher waren
// Mitternacht/Lampion-Nacht und Sonnenuntergang/Lack & Gold praktisch gleich,
// und Seidenpapier war kaum zu sehen. Der Farbfleck im Design-Screen zeigt
// dieselbe Lage über einem Tempel-Ausschnitt, kann also nicht mehr vom
// Ergebnis abweichen. `classic` bleibt ohne Tönung (der freigegebene Look).
// Die alten `--felt`-Variablen sind entfallen; nichts malt sie seit 11.08.2026.
// Preise bewusst unverändert (Josefs Entscheidung 05.11.2026), Liste nach Preis.

export interface Theme {
  id: string;
  label: string;
  cost: number;
  vars: Record<string, string>; // CSS-Variablen, die auf :root gesetzt werden
}

export const THEMES: Theme[] = [
  { id: 'classic', label: 'theme.classic', cost: 0, vars: { '--wash': 'transparent', '--wash-top': 'transparent', '--accent': '#35a06d' } },
  { id: 'midnight', label: 'theme.midnight', cost: 300, vars: { '--wash': 'rgba(18, 40, 92, 0.42)', '--wash-top': 'rgba(10, 22, 60, 0.50)', '--accent': '#5ea0ff' } },
  { id: 'sakura', label: 'theme.sakura', cost: 500, vars: { '--wash': 'rgba(200, 80, 130, 0.30)', '--wash-top': 'rgba(125, 43, 78, 0.38)', '--accent': '#ff9ec7' } },
  { id: 'sunset', label: 'theme.sunset', cost: 500, vars: { '--wash': 'rgba(240, 140, 60, 0.34)', '--wash-top': 'rgba(150, 60, 120, 0.30)', '--accent': '#ffb347' } },
  { id: 'jade', label: 'theme.jade', cost: 800, vars: { '--wash': 'rgba(13, 110, 100, 0.36)', '--wash-top': 'rgba(8, 70, 66, 0.40)', '--accent': '#4fe0c0' } },
  { id: 'seide', label: 'theme.seide', cost: 800, vars: { '--wash': 'rgba(232, 214, 170, 0.30)', '--wash-top': 'rgba(200, 180, 140, 0.24)', '--accent': '#d9c9a3' } },
  { id: 'lackrot', label: 'theme.lackrot', cost: 900, vars: { '--wash': 'rgba(130, 18, 14, 0.44)', '--wash-top': 'rgba(70, 8, 8, 0.46)', '--accent': '#e6b74a' } },
  { id: 'lampion', label: 'theme.lampion', cost: 1000, vars: { '--wash': 'rgba(214, 104, 40, 0.32)', '--wash-top': 'rgba(28, 22, 70, 0.52)', '--accent': '#ff9d4d' } },
];

// --- Stein-Designs (Skins) --------------------------------------------------
// Wirken über ein data-skin-Attribut: global auf <html>, im Design-Screen je
// Vorschau eigens (CSS-Variablen in styles.css erben vom nächsten [data-skin]).

export interface TileSkin {
  id: string;
  label: string;
  cost: number;
}

export const TILE_SKINS: TileSkin[] = [
  { id: 'ivory', label: 'skin.ivory', cost: 0 },
  { id: 'contrast', label: 'skin.contrast', cost: 300 },
  { id: 'sakura', label: 'skin.sakura', cost: 400 },
  { id: 'minimal', label: 'skin.minimal', cost: 500 },
  { id: 'neon', label: 'skin.neon', cost: 700 },
  ];

export function getSkin(id: string): TileSkin {
  return TILE_SKINS.find((s) => s.id === id) ?? TILE_SKINS[0];
}

export function applySkin(id: string) {
  document.documentElement.setAttribute('data-skin', getSkin(id).id);
}

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
}
