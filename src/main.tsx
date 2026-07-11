import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initAds } from './ads/admob'
import { initIAP } from './store/iap'
import { TileDefs } from './ui/Tile'
import { AppBackground } from './ui/AppBackground'
import { FactHost } from './ui/FactHost'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TileDefs />
    <AppBackground />
    <App />
    <FactHost />
  </React.StrictMode>,
)

// Ads & Käufe nur auf nativen Plattformen; im Browser passiert hier nichts.
initAds().catch((e) => console.warn('AdMob init übersprungen:', e))
initIAP().catch((e) => console.warn('IAP init übersprungen:', e))

// PWA-Service-Worker nur im (sicheren) Web-Kontext, nicht in der nativen App.
import { Capacitor } from '@capacitor/core'
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
