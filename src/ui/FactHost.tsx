// Global gemountete „Wusstest du?“-Karte. Modi rufen presentFact() am Runden-
// Übergang auf und starten die nächste Runde erst nach dem Auflösen des Promise.

import { useSyncExternalStore } from 'react';
import { nextFact, type Fact } from '../game/facts';
import { currentLang, t } from '../i18n';
import { Tile } from './Tile';

let enabled = true;
let current: Fact | null = null;
let resolver: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setFactsEnabled(on: boolean) {
  enabled = on;
}

// Zeigt eine Karte und löst auf, sobald sie weggetippt wird oder der Balken durch ist.
// Deaktiviert oder bereits offen -> sofort auflösen (kein Stapeln/Deadlock).
export function presentFact(): Promise<void> {
  if (!enabled || current) return Promise.resolve();
  return new Promise<void>((resolve) => {
    current = nextFact();
    resolver = resolve;
    emit();
  });
}

function dismiss() {
  if (!current) return;
  const r = resolver;
  resolver = null;
  // Erst den Aufrufer weiterlaufen lassen (er baut die nächste Runde auf) und
  // die Karte ein Bild später ausblenden. Sonst ist für einen Moment wieder die
  // alte Sieg-Karte zu sehen, bevor das neue Brett steht.
  r?.();
  requestAnimationFrame(() => {
    current = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => current;

export function FactHost() {
  const fact = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!fact) return null;
  const text = currentLang() === 'en' ? fact.en : fact.de;
  return (
    <div className="overlay fact-overlay" onClick={dismiss}>
      <div className="fact-card" onClick={dismiss}>
        <div className="fact-cat">{t('fact.cat.' + fact.cat)}</div>
        <p className="fact-quote">„{text}“</p>
        <div className="fact-tile"><Tile face="dragonG" /></div>
        <div className="fact-bar">
          <div className="fact-bar-fill" onAnimationEnd={dismiss} />
        </div>
      </div>
    </div>
  );
}
