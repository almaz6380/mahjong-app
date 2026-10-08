// Einladungslinks: https://mahjong.almaz6380.workers.dev/duell/ABC23
//
// Im Browser leitet der Worker den Link auf /?duell=ABC23 um (die App liegt
// mit relativen Pfaden im Wurzelverzeichnis, unter /duell/ fänden ihre
// Dateien nicht). In der installierten App öffnet das System den Link direkt
// (Universal Links / App Links) und meldet ihn über `appUrlOpen`.

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { normalizeCode } from './protocol';

export function codeFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const q = u.searchParams.get('duell');
    if (q) return normalizeCode(q);
    const m = u.pathname.match(/\/duell\/([A-Za-z0-9]+)/);
    return m ? normalizeCode(m[1]) : null;
  } catch {
    return null;
  }
}

/** Code aus der Adresse beim Start (Web) — und die Adresse danach aufräumen. */
export function consumeInviteCode(): string | null {
  if (typeof window === 'undefined') return null;
  const code = codeFromUrl(window.location.href);
  if (code) {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('duell');
      window.history.replaceState(null, '', u.pathname.replace(/\/duell\/.*$/, '/') + u.search + u.hash);
    } catch {
      /* egal */
    }
  }
  return code;
}

/** Link öffnet die laufende oder gerade gestartete App. Rückgabe: abmelden. */
export function onInviteLink(cb: (code: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const h = App.addListener('appUrlOpen', (e) => {
    const code = codeFromUrl(e.url);
    if (code) cb(code);
  });
  return () => {
    h.then((x) => x.remove()).catch(() => {});
  };
}
