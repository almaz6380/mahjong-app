import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// ===========================================================================
//  AdMob-Anbindung (Interstitial + Rewarded)
// ===========================================================================
// KEIN Banner mehr (8.8.2026): Der Streifen unten am Spielbrett hat gestört und
// saß direkt unter der Bedienleiste — Fehltipps darauf wertet Google als
// ungültigen Traffic. Die Banner-Anzeigenblöcke bleiben in AdMob bestehen
// (IDs in admob-ids.md), falls wir es je zurückdrehen wollen.
// PROD-IDs sind eingetragen (Konto pub-8860791993288062, siehe admob-ids.md).
// Solange USE_TEST_ADS = true laufen Google-Test-Anzeigen (Pflicht während der
// Entwicklung — echte IDs anklicken wäre ein Policy-Verstoß!).
// Vor dem Launch-Build nur noch: USE_TEST_ADS = false setzen.
// ===========================================================================

const USE_TEST_ADS = false;

const TEST = {
  ios: {
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
  android: {
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
};

const PROD = {
  ios: {
    interstitial: 'ca-app-pub-8860791993288062/5884824014',
    rewarded: 'ca-app-pub-8860791993288062/6048510934',
  },
  android: {
    interstitial: 'ca-app-pub-8860791993288062/2300837611',
    rewarded: 'ca-app-pub-8860791993288062/9987755941',
  },
};

function ids() {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  return (USE_TEST_ADS ? TEST : PROD)[platform];
}

const isNative = Capacitor.isNativePlatform();

// „Werbung entfernen"-Kauf: blendet die Interstitials aus.
let adsRemoved = false;
export function setAdsRemoved(removed: boolean) {
  adsRemoved = removed;
}

// AdMob-Modul wird dynamisch geladen, damit der Web-Build es nicht zwingend braucht.
let AdMob: any = null;
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

    // Der iOS-Tracking-Dialog (ATT) kommt seit 1.1.2 NICHT mehr hier beim Start,
    // sondern erst unmittelbar vor der ersten Werbung — siehe
    // ensureTrackingAuthorization(). Bis dahin laufen Anzeigen ohne
    // Personalisierung; Apple erlaubt das ausdruecklich.

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

// iOS ab 14: Tracking-Erlaubnis (ATT) einmalig erfragen — aber erst, wenn
// gleich wirklich eine Anzeige kommt. Bis 1.1.1 stand dieser Dialog beim
// allerersten Start, VOR der Startseite, direkt neben der Mitteilungs-Frage:
// zwei Bettel-Dialoge, bevor der Spieler einen Stein gesehen hatte. Ein
// Spieler, der Level 3 erreicht hat, hat einen Grund, hier zuzustimmen.
//
// Gefragt wird seit Build 25 NATIV im AppDelegate, nicht mehr ueber
// `AdMob.requestTrackingAuthorization()`: Das Plugin ruft ATTrackingManager
// auf Capacitors Hintergrund-Warteschlange auf, und dort erscheint der
// Dialog nicht (Apple-Ablehnung bei Anigosha, 12.08.2026). Ohne erteiltes ATT
// keine IDFA, also jede iOS-Anzeige nicht-personalisiert.
//
// Der Ausloeser laeuft ueber @capacitor/preferences: Der Schluessel landet als
// "CapacitorStorage.att.anfrage" in UserDefaults.standard, der AppDelegate
// hoert auf die Aenderung, fragt auf dem Hauptthread und loescht den
// Schluessel wieder. Hier wird nur noch auf die Antwort gewartet, damit die
// erste Anzeige schon mit der Entscheidung laedt.
const ATT_ANFRAGE_KEY = 'att.anfrage'; // muss zu attAnfrageSchluessel im AppDelegate passen
const ATT_WARTEZEIT_MS = 20_000; // der Dialog blockiert die Oberflaeche ohnehin
let attChecked = false;
async function ensureTrackingAuthorization(): Promise<void> {
  if (attChecked || Capacitor.getPlatform() !== 'ios') return;
  attChecked = true;
  try {
    const { status } = await AdMob.trackingAuthorizationStatus();
    if (status !== 'notDetermined') return;
    await Preferences.set({ key: ATT_ANFRAGE_KEY, value: '1' });
    const bis = Date.now() + ATT_WARTEZEIT_MS;
    while (Date.now() < bis) {
      await new Promise((r) => setTimeout(r, 250));
      const jetzt = await AdMob.trackingAuthorizationStatus();
      if (jetzt.status !== 'notDetermined') return;
    }
    console.warn('ATT blieb unbeantwortet — Anzeige laeuft ohne Personalisierung.');
  } catch (e) {
    console.warn('ATT-Abfrage fehlgeschlagen:', e);
  }
}

export async function initAds(): Promise<void> {
  if (!isNative) return; // Im Browser: keine Ads.
  const mod = await import('@capacitor-community/admob');
  AdMob = mod.AdMob;
  RewardAdPluginEvents = mod.RewardAdPluginEvents;

  await runConsentFlow();

  await AdMob.initialize({ initializeForTesting: USE_TEST_ADS });
  ready = true;
}

// ---------------------------------------------------------------------------
//  Interstitial – sanfte Policy:
//  erst ab Level 3, nur jedes 3. gewonnene Level, mind. 120 s Abstand.
//  Verlauf: ursprünglich jedes 3. Level / 75 s → mit dem Wegfall des Banners
//  am 8.8.2026 auf jedes 2. verdichtet → am 10.8.2026 auf Josefs Wunsch wieder
//  entzerrt: jedes 3. Level UND 120 s Sperre. Der Mindestabstand ist dabei die
//  eigentliche Bremse — er greift auch für die Spezialmodi
//  (`maybeShowInterstitialModes`), die keinen Level-Zähler haben.
// ---------------------------------------------------------------------------
const INTERSTITIAL_MIN_GAP_MS = 120_000;
const INTERSTITIAL_EVERY_NTH_WIN = 3;
let lastInterstitial = 0;

export function shouldShowInterstitial(level: number, totalWins: number): boolean {
  if (level < 3) return false;
  if (totalWins % INTERSTITIAL_EVERY_NTH_WIN !== 0) return false;
  if (Date.now() - lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return false;
  return true;
}

// Liefert true, wenn eine Anzeige versucht wurde — die Bewertungsanfrage
// (src/review.ts) darf dann im selben Ablauf nicht auch noch kommen.
export async function maybeShowInterstitial(level: number, totalWins: number): Promise<boolean> {
  if (!ready || adsRemoved) return false;
  if (!shouldShowInterstitial(level, totalWins)) return false;
  lastInterstitial = Date.now();
  await ensureTrackingAuthorization();
  try {
    await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: USE_TEST_ADS });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('Interstitial-Ad fehlgeschlagen:', e);
  }
  return true;
}

/** Millisekunden seit dem letzten Interstitial-Versuch (Infinity = noch keiner). */
export function msSinceLastInterstitial(): number {
  return lastInterstitial ? Date.now() - lastInterstitial : Infinity;
}

// Für die Spezialmodi: Interstitial zwischen Runden, nur Zeit-gedrosselt.
export async function maybeShowInterstitialModes(): Promise<void> {
  if (!ready || adsRemoved) return;
  if (Date.now() - lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return;
  lastInterstitial = Date.now();
  await ensureTrackingAuthorization();
  try {
    await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: USE_TEST_ADS });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('Interstitial-Ad fehlgeschlagen:', e);
  }
}

// ---------------------------------------------------------------------------
//  Rewarded – belohntes Video.
//
//  'earned'      = Belohnung verdient, darf gutgeschrieben werden
//  'aborted'     = Video lief, wurde aber abgebrochen -> keine Belohnung
//  'unavailable' = gar kein Video (keine Füllung, kein Netz, Ladefehler)
//
//  WICHTIG (Grund für den Bug „Video gesehen, nichts passiert"):
//  `showRewardVideoAd()` löst im Plugin AUSSCHLIESSLICH im Belohnungs-Callback
//  auf (iOS: userDidEarnRewardHandler, Android: onUserEarnedReward). Bricht der
//  Nutzer ab oder bleibt das Ereignis aus, kommt NIE eine Antwort — ein blankes
//  `await` hängt dann für immer und die Oberfläche tut stumm gar nichts.
//  Deshalb: zusätzlich auf Dismissed/FailedToShow hören und hart auf Zeit
//  begrenzen. Außerdem zählt die Auflösung der Plugin-Promise selbst als Beleg
//  für die Belohnung — nicht nur das Rewarded-Ereignis (sonst kippt ein
//  Reihenfolge-Rennen zwischen Ereignis und Antwort die Belohnung weg).
//
//  Im Web (kein AdMob): simuliert Erfolg, damit sich die Belohnung testen lässt.
// ---------------------------------------------------------------------------
export type RewardOutcome = 'earned' | 'aborted' | 'unavailable';

const REWARD_HARD_TIMEOUT_MS = 180_000; // Notbremse: Video hängt/bleibt offen
const REWARD_AFTER_EARN_MS = 15_000; // Belohnung sicher, Dismissed bleibt aus
const REWARD_AFTER_DISMISS_MS = 400; // kurze Nachfrist für ein spätes Ereignis

// Zwei gleichzeitige Anfragen (Doppeltipp) würden sich dieselben Ereignisse
// teilen — im schlimmsten Fall wird EIN Video zweimal gutgeschrieben.
let rewardInFlight = false;

export async function requestReward(): Promise<RewardOutcome> {
  if (!ready) return 'earned'; // Web/Dev-Fallback: Belohnung simulieren.
  if (rewardInFlight) {
    console.warn('Rewarded-Ad läuft bereits – zweite Anfrage verworfen.');
    return 'unavailable';
  }
  rewardInFlight = true;
  await ensureTrackingAuthorization();

  const handles: Array<{ remove: () => Promise<void> }> = [];
  let earned = false;
  let shown = false;
  let done!: () => void;
  const finished = new Promise<void>((resolve) => {
    done = resolve;
  });
  let timer = setTimeout(done, REWARD_HARD_TIMEOUT_MS);
  const rearm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(done, ms);
  };

  try {
    handles.push(
      await AdMob.addListener(RewardAdPluginEvents.Showed, () => {
        shown = true;
      }),
    );
    handles.push(
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earned = true;
        rearm(REWARD_AFTER_EARN_MS); // gleich sollte Dismissed folgen
      }),
    );
    handles.push(
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        rearm(REWARD_AFTER_DISMISS_MS);
      }),
    );
    handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done()));

    try {
      await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: USE_TEST_ADS });
    } catch (e) {
      console.warn('Rewarded-Ad konnte nicht geladen werden:', e);
      return 'unavailable';
    }

    // Bewusst ohne await (siehe Kopfkommentar): die Promise kann ewig offen
    // bleiben. Sie zählt nur als zusätzlicher Beleg für die Belohnung.
    AdMob.showRewardVideoAd()
      .then(() => {
        earned = true;
        rearm(REWARD_AFTER_EARN_MS);
      })
      .catch((e: unknown) => {
        console.warn('Rewarded-Ad fehlgeschlagen:', e);
        done();
      });

    await finished;
    return earned ? 'earned' : shown ? 'aborted' : 'unavailable';
  } catch (e) {
    console.warn('Rewarded-Ad fehlgeschlagen:', e);
    return 'unavailable';
  } finally {
    rewardInFlight = false;
    clearTimeout(timer);
    for (const h of handles) {
      try {
        await h.remove();
      } catch {
        /* Listener schon weg – egal */
      }
    }
  }
}
