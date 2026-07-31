// Global gemountete Kaufabfrage „Münzen oder Video?".
//
// Connect und Dimensions haben Münzen bisher WORTLOS abgebucht, sobald genug da
// waren — ein Video bekam man nur, wenn man blank war. Im Solitaire hat man die
// Wahl. Damit das überall gleich ist (und niemandem unbemerkt Münzen abgehen),
// fragen sie jetzt über diesen Host.
//
// Rückgabe: 'coins' | 'video' | null (abgebrochen).

import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n';

export type PayChoice = 'coins' | 'video' | null;

interface Ask {
  what: string; // z. B. „Tipp"
  cost: number;
  coins: number; // aktueller Münzstand
}

let current: Ask | null = null;
let resolver: ((c: PayChoice) => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function askPayment(ask: Ask): Promise<PayChoice> {
  // Schon eine Abfrage offen -> nicht stapeln, sondern abbrechen.
  if (current) return Promise.resolve(null);
  return new Promise<PayChoice>((resolve) => {
    current = ask;
    resolver = resolve;
    emit();
  });
}

function answer(choice: PayChoice) {
  const r = resolver;
  resolver = null;
  current = null;
  emit();
  r?.(choice);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => current;

export function BuyPrompt() {
  const ask = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!ask) return null;
  return (
    <div className="overlay" onClick={() => answer(null)}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="logo">✨</div>
        <h2>{ask.what}</h2>
        <p>{t('buy.how')}</p>
        <button className="big-btn" onClick={() => answer('coins')} disabled={ask.coins < ask.cost}>
          <span className="btn-ico"><Icon name="coin" /> {t('game.coinsBtn', { n: ask.cost })}</span>
        </button>
        <button className="big-btn ghost solid" onClick={() => answer('video')}>
          <span className="btn-ico"><Icon name="video" /> {t('game.watchVideo')}</span>
        </button>
        <button className="text-btn" onClick={() => answer(null)}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
