// „Münzen oder Video?" fragen und die Wahl gleich ausführen.
// Rückgabe true = bezahlt, der Aufrufer darf die Hilfe geben.

import { askPayment } from './BuyPrompt';
import { watchRewardedAd } from './reward';

interface Opts {
  what: string; // Beschriftung, z. B. t('mode.hint')
  cost: number;
  coins: number; // aktueller Stand
  spendCoins: (n: number) => boolean;
}

export async function payOrWatch({ what, cost, coins, spendCoins }: Opts): Promise<boolean> {
  const choice = await askPayment({ what, cost, coins });
  if (choice === 'coins') return spendCoins(cost);
  if (choice === 'video') return watchRewardedAd();
  return false;
}
