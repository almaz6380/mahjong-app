// Board-Stein: bündig kachelnde Deckfläche + Steindicke (Tiefe) an der Unterkante.
// Steine DERSELBEN Ebene stoßen bündig aneinander (kein Filz dazwischen); die 3D-
// Tiefe zeigt sich nur an den Stapel-Stufen und am unteren Rand (die Seitenwand
// ragt DY nach unten und wird vom darunterliegenden Stein derselben Ebene verdeckt).
// Premium-Look wie der Drehstein: heller Elfenbein-Verlauf, runde Ecken, Glanz.
import { motif, normalizeFace } from './Tile';

// Raster in „Tile-Units" (1u = 1px im unskalierten Board; Board skaliert zum Fit).
export const STONE = {
  W: 60,     // Deckflächen-Breite  (Raster-Schritt Spalte)
  H: 80,     // Deckflächen-Höhe    (Raster-Schritt Reihe)
  DEPTH: 13, // sichtbare Steindicke unten (= Stapel-Versatz DY)
  DX: 0,
  DY: 13,
};

interface Props { faceId: string; selected?: boolean; hint?: boolean; dim?: boolean }

export function StoneTile({ faceId, selected, hint, dim }: Props) {
  const cls = 'stoneface'
    + (selected ? ' sel' : '')
    + (hint ? ' hint' : '')
    + (dim ? ' dim' : '');
  return (
    <svg className={cls} viewBox="0 0 60 93" preserveAspectRatio="none">
      {/* Steindicke: rundes Rechteck, um DEPTH nach unten versetzt -> ragt unten heraus */}
      <rect x="0.5" y="13" width="59" height="79" rx="9" fill="url(#stoneSide)" stroke="rgba(50,38,14,.28)" strokeWidth="0.5" />
      {/* Deckfläche (mit 0.5u Bleed -> benachbarte Steine stoßen bündig, kein Filz) */}
      <rect x="-0.5" y="-0.5" width="61" height="81" rx="8" fill="url(#stoneFront)" />
      {motif(normalizeFace(faceId))}
      {/* Glanzlicht oben + feine Kante */}
      <rect x="0" y="0" width="60" height="80" rx="8" fill="url(#stoneGloss)" />
      <rect x="0.3" y="0.3" width="59.4" height="79.4" rx="8" fill="none" stroke="rgba(60,45,15,.20)" strokeWidth="0.7" />
    </svg>
  );
}
