// Wer bin ich im Duell? Eine zufällige Spieler-ID (bleibt auf dem Gerät) und
// ein erzeugter Name. Bewusst KEINE Freitext-Namen: Bei zufälligen Gegnern
// müsste man sonst Beleidigungen filtern, und ein Konto braucht es so nicht.

import { Preferences } from '@capacitor/preferences';
import { currentLang } from '../i18n';

const KEY = 'duel.identity';

export interface DuelIdentity {
  pid: string;
  name: string;
}

const FARBEN = {
  de: ['Jade', 'Gold', 'Bambus', 'Lotus', 'Nebel', 'Mond', 'Kirsch', 'Perlen', 'Lack', 'Seiden', 'Zinnober', 'Tusche'],
  en: ['Jade', 'Golden', 'Bamboo', 'Lotus', 'Misty', 'Moon', 'Cherry', 'Pearl', 'Lacquer', 'Silk', 'Vermilion', 'Ink'],
};
const TIERE = {
  de: ['Drache', 'Kranich', 'Tiger', 'Phönix', 'Panda', 'Koi', 'Fuchs', 'Falke', 'Schildkröte', 'Kirin', 'Reiher', 'Löwe'],
  en: ['Dragon', 'Crane', 'Tiger', 'Phoenix', 'Panda', 'Koi', 'Fox', 'Falcon', 'Turtle', 'Kirin', 'Heron', 'Lion'],
};

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export function randomName(): string {
  const l = currentLang() === 'de' ? 'de' : 'en';
  const n = 10 + Math.floor(Math.random() * 90);
  return l === 'de' ? `${pick(FARBEN.de)}-${pick(TIERE.de)} ${n}` : `${pick(FARBEN.en)} ${pick(TIERE.en)} ${n}`;
}

function randomId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

let cache: DuelIdentity | null = null;

export async function getIdentity(): Promise<DuelIdentity> {
  if (cache) return cache;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      const v = JSON.parse(value) as DuelIdentity;
      if (v.pid && v.name) return (cache = v);
    }
  } catch {
    /* neu anlegen */
  }
  cache = { pid: randomId(), name: randomName() };
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(cache) });
  } catch {
    /* dann eben nur für diese Sitzung */
  }
  return cache;
}

/** Neuer Name auf Wunsch („Würfeln"). Die ID bleibt. */
export async function rerollName(): Promise<DuelIdentity> {
  const id = await getIdentity();
  cache = { pid: id.pid, name: randomName() };
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(cache) });
  } catch {
    /* egal */
  }
  return cache;
}
