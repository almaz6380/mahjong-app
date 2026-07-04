import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initAds } from './ads/admob'
import { TileDefs } from './ui/Tile'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TileDefs />
    <App />
  </React.StrictMode>,
)

// Ads nur auf nativen Plattformen; im Browser passiert hier nichts.
initAds().catch((e) => console.warn('AdMob init übersprungen:', e))
