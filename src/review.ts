import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { msSinceLastInterstitial } from './ads/admob';

// ===========================================================================
//  Bewertungsanfrage (nativ, ab 1.2.0)
// ===========================================================================
// - Erst nach dem 10. gewonnenen Level, danach höchstens alle 90 Tage.
// - NIE im selben Ablauf wie ein Interstitial: Wer gerade Werbung gesehen hat,
//   bewertet schlecht — und zwei Unterbrechungen hintereinander sind unhöflich.
// - KEINE Belohnung dafür. Apple (5.6.1/3.2.2) und Google verbieten Anreize
//   für Bewertungen; das System drosselt ohnehin selbst (iOS max. 3×/Jahr) und
//   meldet nicht zurück, ob bewertet wurde.
// - Im Web gibt es nichts zu fragen.
// ===========================================================================

const LAST_ASK_KEY = 'review.lastAsk';
const MIN_WINS = 10;
const GAP_MS = 90 * 24 * 60 * 60 * 1000;
// Puffer, falls ein Interstitial aus einem anderen Ablauf gerade erst lief.
const AFTER_AD_MS = 60 * 1000;

export async function maybeAskForReview(totalWins: number, interstitialShown: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (interstitialShown || totalWins < MIN_WINS) return;
  if (msSinceLastInterstitial() < AFTER_AD_MS) return;
  try {
    const { value } = await Preferences.get({ key: LAST_ASK_KEY });
    const last = value ? Number(value) : 0;
    if (last && Date.now() - last < GAP_MS) return;
    // Vor dem Aufruf merken: Beendet das System die App währenddessen, käme
    // die Frage sonst beim nächsten Sieg gleich wieder.
    await Preferences.set({ key: LAST_ASK_KEY, value: String(Date.now()) });
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch (e) {
    console.warn('Bewertungsanfrage fehlgeschlagen:', e);
  }
}
