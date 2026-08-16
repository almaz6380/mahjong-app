// Besucherzählung — AUSSCHLIESSLICH für die Web-Fassung (Vercel Web Analytics).
//
// ⚠ Die eine Regel, an der hier alles hängt: **nicht in der nativen App laden.**
// Capacitor kopiert das fertige Web-Bundle unverändert nach ios/ und android/
// (`npx cap sync`) — ohne die Sperre unten würden also auch die Store-Apps
// Aufrufe an Vercel senden. Das wäre eine neue Datenweitergabe und müsste in den
// Datenschutzangaben beider Stores UND in `public/privacy.html` stehen
// ("App Privacy" bei Apple, "Data safety" bei Play). Die App selbst bleibt
// bewusst frei von eigener Analytik; gezählt wird nur die Seite unter
// mahjong-app-plum.vercel.app.
//
// Was Vercel liefert: Besucher und Seitenaufrufe im Zeitverlauf (stundengenau),
// Herkunft (Referrer — also z. B. Instagram/TikTok), Land, Gerät und Browser.
// Cookiefrei und ohne geräteübergreifende Kennung, deshalb ist kein
// Zustimmungsbanner nötig.
//
// Sichtbar wird das erst, wenn im Vercel-Projekt "mahjong-app" unter
// Analytics der Schalter umgelegt ist — vorher liefert /_vercel/insights/ 404
// und es wird schlicht nichts gezählt.
import { Capacitor } from '@capacitor/core'
import { inject } from '@vercel/analytics'

export function initAnalytics() {
  if (Capacitor.isNativePlatform()) return
  // Das Zählskript liegt unter /_vercel/insights/script.js und existiert nur
  // auf einem Vercel-Deployment. Lokal (npm run dev / vite preview) liefe es
  // ins Leere und würde die Konsole mit 404ern zumüllen.
  const host = location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '') return
  inject()
}
