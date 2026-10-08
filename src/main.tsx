import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initAds } from './ads/admob'
import { initIAP } from './store/iap'
import { TileDefs } from './ui/Tile'
import { AppBackground } from './ui/AppBackground'
import { FactHost } from './ui/FactHost'
import { ToastHost } from './ui/ToastHost'
import { BuyPrompt } from './ui/BuyPrompt'
import homeTemple from './assets/home-temple.webp'
import emblemShield from './assets/emblem-shield.webp'
import symbolZhong from './assets/symbol-zhong.webp'
import { nextFact } from './game/facts'
import { detectLang, setLanguage, factText } from './i18n'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TileDefs />
    <AppBackground />
    <App />
    <FactHost />
    <ToastHost />
    <BuyPrompt />
  </React.StrictMode>,
)

// ---- Ladebildschirm: kritische Bilder vorladen, Balken füllen, dann ausblenden ----
;(() => {
  const splash = document.getElementById('splash')
  if (!splash) return
  const fill = document.getElementById('splash-bar-fill')
  const tipEl = document.getElementById('splash-tip')
  // Vorläufig die Systemsprache aktivieren; App.tsx überstimmt später mit
  // der gespeicherten Wahl aus dem Fortschritt.
  setLanguage(detectLang())

  const showTip = () => {
    if (!tipEl) return
    tipEl.style.opacity = '0'
    setTimeout(() => {
      tipEl.textContent = factText(nextFact())
      tipEl.style.opacity = '1'
    }, 200)
  }
  showTip()
  const tipTimer = window.setInterval(showTip, 2600)

  const assets = [homeTemple, emblemShield, symbolZhong, '/splash.webp']
  let done = 0
  const bump = () => {
    done++
    if (fill) fill.style.width = Math.round((done / assets.length) * 100) + '%'
  }
  const preload = Promise.all(
    assets.map(
      (src) =>
        new Promise<void>((res) => {
          const img = new Image()
          img.onload = img.onerror = () => {
            bump()
            res()
          }
          img.src = src
        }),
    ),
  )

  const MIN_MS = 2400
  const started = performance.now()
  const finish = () => {
    window.clearInterval(tipTimer)
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 500)
  }
  // Nach Vorladen + Mindestdauer ausblenden; Sicherheits-Timeout bei hängendem Bild.
  Promise.race([preload, new Promise((r) => setTimeout(r, 5000))]).then(() => {
    const wait = Math.max(0, MIN_MS - (performance.now() - started))
    setTimeout(finish, wait)
  })
})()

// Ads & Käufe nur auf nativen Plattformen; im Browser passiert hier nichts.
initAds().catch((e) => console.warn('AdMob init übersprungen:', e))
initIAP().catch((e) => console.warn('IAP init übersprungen:', e))

// Besucherzählung nur im Web (Cloudflare), nie in der nativen App — siehe analytics.ts.
import { initAnalytics } from './analytics'
initAnalytics()

// PWA-Service-Worker nur im (sicheren) Web-Kontext, nicht in der nativen App.
import { Capacitor } from '@capacitor/core'
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
