import { Capacitor } from '@capacitor/core';
import { t } from '../i18n';
import { openExternal } from './external';

// „Mehr von WellApps": die anderen Apps desselben Studios (Einstellungen, über
// den Rechtslinks). Reine Eigenwerbung — kein Werbenetz, kein Tracking, nichts
// wird nachgeladen: die Symbole liegen in src/assets/wellapps/ (Dateiname = id).
// Die Liste wird in allen sieben Apps identisch gepflegt; hier fehlt nur der
// eigene Eintrag (id `mahjong`). Neue App: Zeile hier + Symbol <id>.webp +
// Schlüssel `wa.<id>` (Kurzzeile) in i18n.ts und allen src/locales/*.ts.
const ICONS = import.meta.glob('../assets/wellapps/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

interface WellApp {
  id: string;
  name: string;      // unübersetzt — oder ein i18n-Schlüssel (nameKey)
  nameKey?: string;
  ios: string;       // App-Store-ID
  android: string;   // Android-Paket
}

const APPS: WellApp[] = [
  { id: 'fixthemix', name: 'FixTheMix', ios: '6818787934', android: 'at.gallab.fixthemix' },
  { id: 'anigosha', name: 'Anigosha', ios: '6797757350', android: 'at.gallab.animequiz' },
  { id: 'swaply', name: 'Swaply', ios: '6787695557', android: 'at.gallab.swaply' },
  { id: 'weltgeschichte', name: 'World History', nameKey: 'wa.weltgeschichte.name', ios: '6811862606', android: 'de.almaz.weltgeschichte' },
  { id: 'watten', name: 'Watten & Schnapsen', ios: '6800774882', android: 'at.doppeldeutsch.karten' },
  { id: 'fullrep', name: 'FullRep', ios: '6788461300', android: 'at.gallab.mypeak' },
];

// iOS (native App oder iPhone/iPad-Browser) → App Store, alles andere → Play.
// iPadOS meldet sich als „MacIntel" — erkennbar nur an den Touch-Punkten.
function isIOS(): boolean {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === 'ios';
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function storeUrl(app: WellApp): string {
  return isIOS()
    ? `https://apps.apple.com/app/id${app.ios}`
    : `https://play.google.com/store/apps/details?id=${app.android}`;
}

export function WellApps() {
  return (
    <>
      <div className="stats-section">{t('wa.title')}</div>
      <div className="set-nav wellapps">
        {APPS.map((app) => (
          <button key={app.id} onClick={() => openExternal(storeUrl(app))}>
            <img src={ICONS[`../assets/wellapps/${app.id}.webp`]} alt="" width={48} height={48} />
            <span className="wa-text">
              <b>{app.nameKey ? t(app.nameKey) : app.name}</b>
              <small>{t(`wa.${app.id}`)}</small>
            </span>
            <i className="chev" aria-hidden="true">↗</i>
          </button>
        ))}
      </div>
    </>
  );
}
