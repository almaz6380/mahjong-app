import { Capacitor } from '@capacitor/core';

// ===========================================================================
//  AdMob-Anbindung (Banner + Interstitial + Rewarded)
// ===========================================================================
// Aktuell mit GOOGLE-TEST-IDs verdrahtet -> zeigt sofort Test-Anzeigen an,
// ohne dass ein echtes Konto nötig ist. Vor dem Launch:
//   1. AdMob-Konto anlegen (https://admob.google.com)
//   2. App + Ad-Units (Banner/Interstitial/Rewarded) für iOS & Android erstellen
//   3. Die IDs unten in PROD ersetzen und USE_TEST_ADS = false setzen
//   4. App-IDs in ios/.../Info.plist bzw. android/.../AndroidManifest.xml eintragen
// ===========================================================================

const USE_TEST_ADS = true;

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
    banner: 'DEINE_IOS_BANNER_ID',
    interstitial: 'DEINE_IOS_INTERSTITIAL_ID',
    rewarded: 'DEINE_IOS_REWARDED_ID',
  },
  android: {
    banner: 'DEINE_ANDROID_BANNER_ID',
    interstitial: 'DEINE_ANDROID_INTERSTITIAL_ID',
    rewarded: 'DEINE_ANDROID_REWARDED_ID',
  },
};

function ids() {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  return (USE_TEST_ADS ? TEST : PROD)[platform];
}

const isNative = Capacitor.isNativePlatform();

// „Werbung entfernen"-Kauf: blendet Banner + Interstitial aus.
let adsRemoved = false;
export function setAdsRemoved(removed: boolean) {
  adsRemoved = removed;
  if (removed && ready) {
    AdMob.removeBanner?.().catch?.(() => {});
  }
}

// AdMob-Modul wird dynamisch geladen, damit der Web-Build es nicht zwingend braucht.
let AdMob: any = null;
let BannerAdPosition: any = null;
let BannerAdSize: any = null;
let RewardAdPluginEvents: any = null;
let ready = false;

export async function initAds(): Promise<void> {
  if (!isNative) return; // Im Browser: keine Ads.
  const mod = await import('@capacitor-community/admob');
  AdMob = mod.AdMob;
  BannerAdPosition = mod.BannerAdPosition;
  BannerAdSize = mod.BannerAdSize;
  RewardAdPluginEvents = mod.RewardAdPluginEvents;

  await AdMob.initialize({ initializeForTesting: USE_TEST_ADS });
  ready = true;
  await showBanner();
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
