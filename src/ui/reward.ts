// Belohntes Video anbieten und dabei IMMER Rückmeldung geben.
//
// Vorher riefen die Modi `showRewarded()` direkt auf und stiegen bei `false`
// wortlos aus — für den Spieler sah jeder Fehlschlag so aus, als hätte die App
// die Belohnung geschluckt (genau der gemeldete Fehler beim Mischen).
// Rückgabe true = Belohnung verdient, der Aufrufer darf gutschreiben.

import { requestReward } from '../ads/admob';
import { showToast } from './ToastHost';
import { t } from '../i18n';

export async function watchRewardedAd(): Promise<boolean> {
  const outcome = await requestReward();
  if (outcome === 'earned') return true;
  showToast(t(outcome === 'aborted' ? 'game.rewardAborted' : 'game.rewardUnavailable'));
  return false;
}
