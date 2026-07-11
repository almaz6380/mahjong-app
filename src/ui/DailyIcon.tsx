// „Täglich"-Symbol: facettierter 3D-Stern (gefaltete Flächen mit Licht/Schatten,
// Glanz und weichem Schlagschatten) – hochwertiger Gold-Look.
const STAR = 'M28 6 L33.9 19.9 L48.9 21.2 L37.5 31.1 L40.9 45.8 L28 38 L15.1 45.8 L18.5 31.1 L7.1 21.2 L22.1 19.9 Z';
// Facetten (Dreiecke von der Mitte): abwechselnd hell (linke Faltseite) / dunkel (rechte).
const LIGHT = [
  'M28 28 L33.9 19.9 L48.9 21.2 Z',
  'M28 28 L37.5 31.1 L40.9 45.8 Z',
  'M28 28 L28 38 L15.1 45.8 Z',
  'M28 28 L18.5 31.1 L7.1 21.2 Z',
  'M28 28 L22.1 19.9 L28 6 Z',
];
const DARK = [
  'M28 28 L28 6 L33.9 19.9 Z',
  'M28 28 L48.9 21.2 L37.5 31.1 Z',
  'M28 28 L40.9 45.8 L28 38 Z',
  'M28 28 L15.1 45.8 L18.5 31.1 Z',
  'M28 28 L7.1 21.2 L22.1 19.9 Z',
];

export function DailyIcon() {
  return (
    <svg className="daily-ico" viewBox="0 0 56 56" width="48" height="48" aria-hidden="true">
      <defs>
        <radialGradient id="starSheen" cx="0.42" cy="0.26" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="starShadow" x="-35%" y="-25%" width="170%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#07130d" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter="url(#starShadow)">
        {/* Basis (deckt Naht-Kanten ab) */}
        <path d={STAR} fill="#e39f2b" />
        {/* Facetten */}
        {DARK.map((d, i) => <path key={'d' + i} d={d} fill="#e2982c" />)}
        {LIGHT.map((d, i) => <path key={'l' + i} d={d} fill="#ffdd80" />)}
        {/* Glanz-Overlay */}
        <path d={STAR} fill="url(#starSheen)" />
        {/* Kontur */}
        <path d={STAR} fill="none" stroke="#b9761c" strokeWidth="1.1" strokeLinejoin="round" />
        {/* kleiner Spitzlichtpunkt */}
        <circle cx="23.5" cy="15.5" r="1.7" fill="#ffffff" opacity="0.75" />
      </g>
    </svg>
  );
}
