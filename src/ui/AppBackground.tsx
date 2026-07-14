import { Tile } from './Tile';
import { SumiE } from './SumiE';

// Globaler App-Hintergrund: farbige Ambient-Glows, Sumi-e-Tuschmotiv (wechselt
// mit dem Level-Bereich) + großer, leuchtender Mahjong-Stein als Wasserzeichen.
// Liegt fix hinter der gesamten Oberfläche (z-index 0).
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden>
      <div className="app-bg-glow app-bg-glow-1" />
      <div className="app-bg-glow app-bg-glow-2" />
      <div className="app-bg-glow app-bg-glow-3" />
      <SumiE />
      <div className="app-bg-tile">
        <Tile face="dragonR" />
      </div>
    </div>
  );
}
