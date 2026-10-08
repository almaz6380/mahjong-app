// Besucherzählung — AUSSCHLIESSLICH für die Web-Fassung (Cloudflare Web Analytics,
// seit 08.10.2026; vorher Vercel Web Analytics, das mit dem Umzug zu Cloudflare
// ins Leere lief).
//
// ⚠ Die eine Regel, an der hier alles hängt: **nicht in der nativen App laden.**
// Capacitor kopiert das fertige Web-Bundle unverändert nach ios/ und android/
// (`npx cap sync`) — ohne die Sperre unten würden also auch die Store-Apps
// Aufrufe an Cloudflare senden. Das wäre eine neue Datenweitergabe und müsste in
// den Datenschutzangaben beider Stores UND in `public/privacy.html` stehen
// ("App Privacy" bei Apple, "Data safety" bei Play). Die App selbst bleibt
// bewusst frei von eigener Analytik; gezählt wird nur die Seite unter
// mahjong.almaz6380.workers.dev.
//
// Was Cloudflare liefert: Besucher und Seitenaufrufe im Zeitverlauf, Herkunft
// (Referrer — also z. B. Instagram/TikTok), Land, Gerät und Browser. Cookiefrei,
// nichts im Speicher des Geräts, keine geräteübergreifende Kennung — deshalb ist
// kein Zustimmungsbanner nötig.
//
// Das Token ist öffentlich (es steht in jedem Seitenquelltext) und gehört zur
// Seite „mahjong.almaz6380.workers.dev" in Cloudflare → Web Analytics. Dieselbe
// Zeile steht fest in public/links.html, privacy.html, impressum.html, terms.html.
import { Capacitor } from '@capacitor/core'

export const CF_BEACON_TOKEN = '7a60644ec943494bbf341d92d5bb594a'

export function initAnalytics() {
  if (Capacitor.isNativePlatform()) return
  // Lokal (npm run dev / vite preview) soll nichts gezählt werden.
  const host = location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '') return
  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }))
  document.body.appendChild(s)
}
