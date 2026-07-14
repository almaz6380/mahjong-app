import { useSyncExternalStore } from 'react';

// Sumi-e-Hintergründe: dezente Tuschmalerei-Silhouetten hinter der App.
// Das Motiv wechselt deterministisch mit dem Level-Bereich (alle 50 Level).
// Reines Inline-SVG in Elfenbein-Tusche mit sehr niedriger Deckkraft.

let ambientLevel = 1;
const subs = new Set<() => void>();

export function setAmbientLevel(level: number) {
  const l = Math.max(1, Math.floor(level));
  if (l === ambientLevel) return;
  ambientLevel = l;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

const INK = 'rgba(244,236,216,1)'; // Elfenbein-„Tusche" (Deckkraft kommt vom Layer)

// --- Motive (viewBox 400×300, unten bündig) --------------------------------

function Berge() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M0 300 L0 210 Q60 130 120 185 Q170 230 220 195 Q290 145 400 205 L400 300 Z" fill={INK} opacity="0.5" />
      <path d="M0 300 L0 250 Q90 185 170 235 Q240 280 320 240 Q360 220 400 245 L400 300 Z" fill={INK} opacity="0.8" />
      <path d="M40 172 Q70 120 96 165 Q110 190 128 180" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function Bambus() {
  const stalk = (x: number, lean: number, w: number, o: number) => (
    <g transform={`translate(${x} 0) rotate(${lean} 0 300)`} opacity={o}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={-w / 2} y={40 + i * 66} width={w} height={58} rx={w / 2} fill={INK} />
      ))}
    </g>
  );
  const leaf = (x: number, y: number, a: number) => (
    <path d={`M0 0 Q22 -6 44 2 Q22 8 0 0 Z`} fill={INK} transform={`translate(${x} ${y}) rotate(${a})`} />
  );
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {stalk(70, -4, 13, 0.85)}
      {stalk(112, 3, 9, 0.55)}
      <g opacity="0.8">
        {leaf(88, 74, -28)}
        {leaf(94, 88, 14)}
        {leaf(60, 120, -160)}
        {leaf(126, 150, -18)}
        {leaf(120, 166, 22)}
      </g>
    </svg>
  );
}

function Kranich() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g opacity="0.85">
        {/* Körper */}
        <path d="M150 168 Q205 150 258 164 Q230 186 196 184 Q168 182 150 168 Z" fill={INK} />
        {/* Oberer Flügel */}
        <path d="M190 162 Q212 84 300 66 Q262 118 232 150 Q212 162 190 162 Z" fill={INK} />
        {/* Unterer Flügel */}
        <path d="M206 176 Q246 204 300 210 Q248 226 214 200 Q206 190 206 176 Z" fill={INK} opacity="0.7" />
        {/* Hals + Kopf */}
        <path d="M152 168 Q120 160 96 142 Q88 136 82 128" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <circle cx="80" cy="126" r="6" fill={INK} />
        <path d="M75 124 L58 120" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        {/* Beine */}
        <path d="M240 178 L286 196 M234 184 L276 210" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </g>
    </svg>
  );
}

function Kiefer() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <g opacity="0.85">
        {/* Stamm */}
        <path d="M118 300 Q130 240 112 196 Q100 164 128 130 Q146 108 142 88" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
        <path d="M116 208 Q160 186 208 190 M126 146 Q170 132 216 140" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
        {/* Nadel-Wolken */}
        <ellipse cx="146" cy="72" rx="64" ry="17" fill={INK} />
        <ellipse cx="224" cy="128" rx="56" ry="14" fill={INK} opacity="0.8" />
        <ellipse cx="216" cy="182" rx="46" ry="12" fill={INK} opacity="0.6" />
      </g>
    </svg>
  );
}

const MOTIFS = [Berge, Bambus, Kranich, Kiefer];

export function SumiE() {
  const level = useSyncExternalStore(subscribe, () => ambientLevel);
  const Motif = MOTIFS[Math.floor((level - 1) / 50) % MOTIFS.length];
  return (
    <div className="sumie" aria-hidden>
      <Motif />
    </div>
  );
}
