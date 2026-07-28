import { Capacitor } from '@capacitor/core';

// ===========================================================================
//  AdMob-Anbindung (Banner + Interstitial + Rewarded)
// ===========================================================================
// PROD-IDs sind eingetragen (Konto pub-8860791993288062, siehe admob-ids.md).
// Solange USE_TEST_ADS = true laufen Google-Test-Anzeigen (Pflicht während der
// Entwicklung — echte IDs anklicken wäre ein Policy-Verstoß!).
// Vor dem Launch-Build nur noch: USE_TEST_ADS = false setzen.
// ===========================================================================

const USE_TEST_ADS = false;

const TEST = {
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
};

const PROD = {
  ios: {
    banner: 'ca-app-pub-8860791993288062/8674674274',
    interstitial: 'ca-app-pub-8860791993288062/5884824014',
    rewarded: 'ca-app-pub-8860791993288062/6048510934',
  },
  android: {
    banner: 'ca-app-pub-8860791993288062/6100481827',
    interstitial: 'ca-app-pub-8860791993288062/2300837611',
    rewarded: 'ca-app-pub-8860791993288062/9987755941',
  },
};

function ids() {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  return (USE_TEST_ADS ? TEST : PROD)[platform];
}

const isNative = Capacitor.isNativePlatform();

// ---------------------------------------------------------------------------
//  Platz für das Banner freihalten
//  Der Banner ist eine NATIVE View ÜBER der WebView — er schiebt das Layout
//  nicht weg, sondern legt sich darüber. Ohne reservierten Platz verdeckt er
//  die Bedienleiste (Neu/Zurück/Tipp/Mischen). Die Layout-Wurzeln rechnen die
//  Höhe über `--banner-space` ein (styles.css); gesetzt wird sie hier aus der
//  echten Bannerhöhe, die das Plugin meldet (dp = CSS-Pixel).
//  Kein Banner (Fehler, entfernt, „Werbung entfernen") -> 0, sonst bliebe ein
//  leerer Streifen stehen.
// ---------------------------------------------------------------------------
function setBannerSpace(px: number) {
  const h = Number.isFinite(px) ? Math.max(0, Math.round(px)) : 0;
  document.documentElement.style.setProperty('--banner-space', `${h}px`);
}

// „Werbung entfernen"-Kauf: blendet Banner + Interstitial aus.
let adsRemoved = false;
export function setAdsRemoved(removed: boolean) {
  adsRemoved = removed;
  if (removed && ready) {
    if (bannerRetryTimer) {
      clearTimeout(bannerRetryTimer);
      bannerRetryTimer = null;
    }
    AdMob.removeBanner?.().catch?.(() => {});
    setBannerSpace(0);
  }
}

// AdMob-Modul wird dynamisch geladen, damit der Web-Build es nicht zwingend braucht.
let AdMob: any = null;
let BannerAdPosition: any = null;
let BannerAdSize: any = null;
let BannerAdPluginEvents: any = null;
let RewardAdPluginEvents: any = null;
let ready = false;

// ---------------------------------------------------------------------------
//  GDPR-Consent (Google UMP) + iOS-App-Tracking-Transparency.
//  Die Consent-Nachricht selbst wird in AdMob konfiguriert
//  (Datenschutz & Mitteilungen -> DSGVO); ohne veröffentlichte Nachricht
//  meldet UMP NOT_REQUIRED und es erscheint kein Dialog.
// ---------------------------------------------------------------------------
async function runConsentFlow(): Promise<void> {
  try {
    const info = await AdMob.requestConsentInfo();

    // iOS ab 14: ATT-Dialog einmalig anzeigen (auf Android nicht vorhanden).
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const tracking = await AdMob.trackingAuthorizationStatus();
        if (tracking.status === 'notDetermined') {
          await AdMob.requestTrackingAuthorization();
        }
      } catch (e) {
        console.warn('ATT-Abfrage fehlgeschlagen:', e);
      }
    }

    if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    // Kein Netz o.ä.: Ads laufen dann ohne personalisierte Einwilligung an;
    // UMP fragt beim nächsten Start erneut.
    console.warn('Consent-Flow fehlgeschlagen:', e);
  }
}

// Für die Einstellungen: Einwilligung nachträglich ändern (DSGVO-Pflicht).
export function canChangeAdConsent(): boolean {
  return isNative;
}

export async function changeAdConsent(): Promise<void> {
  if (!ready) return;
  try {
    await AdMob.resetConsentInfo();
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn('Consent-Änderung fehlgeschlagen:', e);
  }
}

export async function initAds(): Promise<void> {
  if (!isNative) return; // Im Browser: keine Ads.
  const mod = await import('@capacitor-community/admob');
  AdMob = mod.AdMob;
  BannerAdPosition = mod.BannerAdPosition;
  BannerAdSize = mod.BannerAdSize;
  BannerAdPluginEvents = mod.BannerAdPluginEvents;
  RewardAdPluginEvents = mod.RewardAdPluginEvents;

  await runConsentFlow();

  await AdMob.initialize({ initializeForTesting: USE_TEST_ADS });
  ready = true;

  // Ohne Füllung (z.B. neues AdMob-Konto, kein Netz) bliebe der reservierte
  // Banner-Platz als weißer Streifen stehen → Platz freigeben und später neu
  // versuchen. Lädt ein Banner, ist die Fläche echte Werbung statt Leerraum.
  // Meldet die echte Bannerhöhe: beim Laden die Größe, beim Entfernen/Fehler 0.
  // Damit hält das Layout genau so viel Platz frei, wie der Banner belegt.
  AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: { width: number; height: number }) => {
    setBannerSpace(info?.height ?? 0);
  });
  AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    bannerRetryMs = BANNER_RETRY_START_MS;
  });
  AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
    AdMob.removeBanner?.().catch?.(() => {});
    setBannerSpace(0);
    scheduleBannerRetry();
  });

  await showBanner();
}

const BANNER_RETRY_START_MS = 30_000;
const BANNER_RETRY_MAX_MS = 300_000;
let bannerRetryMs = BANNER_RETRY_START_MS;
let bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBannerRetry() {
  if (bannerRetryTimer) return;
  bannerRetryTimer = setTimeout(() => {
    bannerRetryTimer = null;
    showBanner();
  }, bannerRetryMs);
  bannerRetryMs = Math.min(bannerRetryMs * 2, BANNER_RETRY_MAX_MS);
}

export async function showBanner(): Promise<void> {
  if (!ready || adsRemoved) return;
  try {
    await AdMob.showBanner({
      adId: ids().banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: USE_TEST_ADS,
    });
  } catch (e) {
    console.warn('Banner-Ad fehlgeschlagen:', e);
  }
}

// ---------------------------------------------------------------------------
//  Interstitial – sanfte Policy:
//  erst ab Level 3, nur jedes 3. gewonnene Level, mind. 75s Abstand.
// ---------------------------------------------------------------------------
const INTERSTITIAL_MIN_GAP_MS = 75_000;
let lastInterstitial = 0;

export function shouldShowInterstitial(level: number, totalWins: number): boolean {
  if (level < 3) return false;
  if (totalWins % 3 !== 0) return false;
  if (Date.now() - lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return false;
  return true;
}

export async function maybeShowInterstitial(level: number, totalWins: number): Promise<void> {
  if (!ready || adsRemoved) return;
  if (!shouldShowInterstitial(level, totalWins)) return;
  lastInterstitial = Date.now();
  try {
    await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: USE_TEST_ADS });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('Interstitial-Ad fehlgeschlagen:', e);
  }
}

// Für die Spezialmodi: Interstitial zwischen Runden, nur Zeit-gedrosselt.
export async function maybeShowInterstitialModes(): Promise<void> {
  if (!ready || adsRemoved) return;
  if (Date.now() - lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return;
  lastInterstitial = Date.now();
  try {
    await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: USE_TEST_ADS });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('Interstitial-Ad fehlgeschlagen:', e);
  }
}

// ---------------------------------------------------------------------------
//  Rewarded – belohntes Video. Gibt true zurück, wenn der Nutzer die Belohnung
//  verdient hat (Video vollständig gesehen).
//  Im Web (kein AdMob): simuliert Erfolg, damit sich die Belohnung testen lässt.
// ---------------------------------------------------------------------------
export async function showRewarded(): Promise<boolean> {
  if (!ready) return true; // Web/Dev-Fallback: Belohnung simulieren.
  try {
    let earned = false;
    const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      earned = true;
    });
    await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: USE_TEST_ADS });
    await AdMob.showRewardVideoAd();
    await listener.remove();
    return earned;
  } catch (e) {
    console.warn('Rewarded-Ad fehlgeschlagen:', e);
    return false;
  }
}
