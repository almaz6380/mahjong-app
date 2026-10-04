import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// ===========================================================================
//  In-App-Käufe (Shop)
// ===========================================================================
// - Web/Dev: simulierter Kauf, damit sich Shop & „Werbung entfernen" testen lassen.
// - Nativ: cordova-plugin-purchase (v13). Die Produkt-IDs unten müssen exakt so
//   in App Store Connect (In-App-Käufe) und in der Play Console (Produkte)
//   angelegt sein. remove_ads = Non-Consumable, coins_* = Consumable.
// ===========================================================================

export type ProductId = 'remove_ads' | 'coins_small' | 'coins_medium' | 'coins_large';

export interface Product {
  id: ProductId;
  label: string;
  price: string; // Fallback-Anzeigepreis; nativ kommt der echte Preis vom Store
  coins?: number; // Münzen, die der Kauf gutschreibt
  removesAds?: boolean;
  icon: string;
}

export const PRODUCTS: Product[] = [
  { id: 'remove_ads', label: 'shop.removeAds', price: '2,99 €', removesAds: true, icon: '🚫' },
  // Seit 1.2.0 verdreifacht (vorher 500/1500/5000). Die ANZEIGENAMEN der
  // Produkte in App Store Connect und Play Console tragen die Zahl ebenfalls —
  // die müssen von Hand nachgezogen werden, sonst verspricht der Store-Dialog
  // weniger, als gutgeschrieben wird.
  { id: 'coins_small', label: 'shop.coinsSmall', price: '0,99 €', coins: 1500, icon: '🪙' },
  { id: 'coins_medium', label: 'shop.coinsMedium', price: '1,99 €', coins: 4500, icon: '💰' },
  { id: 'coins_large', label: 'shop.coinsLarge', price: '4,99 €', coins: 15000, icon: '💎' },
];

// ===========================================================================
//  Münz-Gutschrift über eine persistente Warteschlange
// ===========================================================================
// Bis 1.1.x schrieb nur die Oberfläche die Münzen gut — über das Promise von
// purchase(), also nur, wenn der Kauf in DERSELBEN Sitzung abgeschlossen wurde.
// Verzögerte Käufe (Ask-to-Buy, ausstehende Zahlung, App während des Kaufs
// beendet) kamen beim nächsten Start über `approved` herein, wurden mit
// tx.finish() verbraucht — und die Münzen waren weg.
//
// Jetzt schreibt der approved-Handler die Münzen VOR tx.finish() in eine
// Warteschlange in Preferences. useProgress leert sie (subscribeCoinCredits).
// Die Transaktions-IDs (letzte 100) verhindern Doppelgutschriften, falls der
// Store dieselbe Transaktion erneut meldet.
const QUEUE_KEY = 'iap.pendingCoins';
const MAX_TX_IDS = 100;

interface CoinQueue {
  coins: number;
  txIds: string[];
}

let queueChain: Promise<unknown> = Promise.resolve();
const coinListeners = new Set<(n: number) => void>();

// Alle Zugriffe auf die Warteschlange nacheinander, sonst überschreiben sich
// zwei gleichzeitige approved-Ereignisse gegenseitig.
function withQueue<T>(fn: (q: CoinQueue) => Promise<T> | T): Promise<T> {
  const run = queueChain.then(async () => {
    let q: CoinQueue = { coins: 0, txIds: [] };
    try {
      const { value } = await Preferences.get({ key: QUEUE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        q = { coins: Number(parsed.coins) || 0, txIds: Array.isArray(parsed.txIds) ? parsed.txIds : [] };
      }
    } catch {
      /* kaputter Eintrag: mit leerer Schlange weiter */
    }
    return fn(q);
  });
  queueChain = run.catch(() => {});
  return run;
}

async function saveQueue(q: CoinQueue): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(q) });
}

/** Münzen eines Kaufs vormerken. Liefert false, wenn die Transaktion schon gezählt war. */
function enqueueCoins(coins: number, txId: string): Promise<boolean> {
  return withQueue(async (q) => {
    if (txId && q.txIds.includes(txId)) return false;
    const txIds = txId ? [...q.txIds, txId].slice(-MAX_TX_IDS) : q.txIds;
    await saveQueue({ coins: q.coins + coins, txIds });
    return true;
  }).then((added) => {
    if (added) void drainCoins();
    return added;
  });
}

/** Gutschriften an alle Abonnenten ausliefern und die Schlange leeren. */
function drainCoins(): Promise<void> {
  if (coinListeners.size === 0) return Promise.resolve();
  return withQueue(async (q) => {
    if (q.coins <= 0) return 0;
    await saveQueue({ coins: 0, txIds: q.txIds });
    return q.coins;
  }).then((n) => {
    if (n > 0) for (const cb of coinListeners) cb(n);
  });
}

/**
 * Münz-Gutschriften abonnieren: liefert ausstehende Münzen sofort und jede
 * neue Gutschrift, sobald sie eintrifft. Gibt die Abmeldefunktion zurück.
 */
export function subscribeCoinCredits(cb: (n: number) => void): () => void {
  coinListeners.add(cb);
  void drainCoins();
  return () => {
    coinListeners.delete(cb);
  };
}

export interface PurchaseResult {
  ok: boolean;
  product?: Product;
  error?: string;
}

const isNative = Capacitor.isNativePlatform();

let store: any = null; // CdvPurchase.Store
let storePlatform: any = null; // CdvPurchase.Platform.*
// Käufe laufen asynchron über Store-Events; pro Produkt ein wartender resolve.
const pendingOrders = new Map<string, (r: PurchaseResult) => void>();

function resolveOrder(id: string, result: PurchaseResult) {
  const resolve = pendingOrders.get(id);
  if (resolve) {
    pendingOrders.delete(id);
    resolve(result);
  }
}

// Das Cordova-Plugin hängt sich als window.CdvPurchase ein; kurz darauf warten.
async function waitForPlugin(timeoutMs = 8000): Promise<any | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cp = (window as any).CdvPurchase;
    if (cp?.store) return cp;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

export async function initIAP(): Promise<void> {
  if (!isNative) return;
  const CdvPurchase = await waitForPlugin();
  if (!CdvPurchase) {
    console.warn('IAP: Plugin nicht geladen.');
    return;
  }
  const { ProductType, Platform } = CdvPurchase;
  storePlatform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
  store = CdvPurchase.store;

  store.register(
    PRODUCTS.map((p) => ({
      id: p.id,
      platform: storePlatform,
      type: p.removesAds ? ProductType.NON_CONSUMABLE : ProductType.CONSUMABLE,
    }))
  );

  store
    .when()
    .approved(async (tx: any) => {
      // Münzen ERST sichern, dann die Transaktion abschließen — ein finish()
      // ohne Gutschrift verbraucht den Kauf endgültig.
      const txId = String(tx.transactionId ?? '');
      for (const tp of tx.products ?? []) {
        const product = PRODUCTS.find((p) => p.id === tp.id);
        if (product?.coins) {
          try {
            await enqueueCoins(product.coins, txId ? `${txId}:${product.id}` : '');
          } catch (e) {
            // Nicht abschließen: Der Store meldet die Transaktion beim nächsten
            // Start erneut, dann klappt das Speichern hoffentlich.
            console.warn('IAP: Gutschrift nicht gespeichert, Abschluss vertagt:', e);
            return;
          }
        }
      }
      tx.finish();
    })
    .finished((tx: any) => {
      for (const tp of tx.products ?? []) {
        const product = PRODUCTS.find((p) => p.id === tp.id);
        if (product) resolveOrder(product.id, { ok: true, product });
      }
    });

  try {
    await store.initialize([storePlatform]);
  } catch (e) {
    console.warn('IAP: Store-Initialisierung fehlgeschlagen:', e);
    store = null;
  }
}

// Echter Store-Preis (lokalisiert), sonst statischer Fallback.
export function displayPrice(p: Product): string {
  const native = store?.get?.(p.id, storePlatform)?.pricing?.price;
  return native || p.price;
}

export async function purchase(id: ProductId): Promise<PurchaseResult> {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: 'Unbekanntes Produkt' };

  if (!isNative) {
    // Web/Dev: Kauf simulieren — über dieselbe Warteschlange wie nativ.
    if (product.coins) await enqueueCoins(product.coins, `web-${Date.now()}-${Math.random()}`);
    return { ok: true, product };
  }

  if (!store) return { ok: false, error: 'Store nicht verfügbar.' };

  const storeProduct = store.get(id, storePlatform);
  const offer = storeProduct?.getOffer?.();
  if (!offer) return { ok: false, error: 'Produkt im Store nicht gefunden.' };

  return new Promise<PurchaseResult>((resolve) => {
    pendingOrders.set(id, resolve);
    offer
      .order()
      .then((err: any) => {
        // order() liefert bei Abbruch/Fehler ein Error-Objekt, sonst undefined;
        // der Erfolgsfall wird über das finished-Event aufgelöst.
        if (err) resolveOrder(id, { ok: false, error: err.message || 'Kauf abgebrochen.' });
      })
      .catch((e: any) => resolveOrder(id, { ok: false, error: e?.message || 'Kauf fehlgeschlagen.' }));
  });
}

// „Käufe wiederherstellen" (von Apple für Non-Consumables vorgeschrieben).
// Liefert true, wenn remove_ads auf diesem Konto vorhanden ist.
export function canRestore(): boolean {
  return isNative;
}

export async function restorePurchases(): Promise<boolean> {
  if (!store) return false;
  try {
    await store.restorePurchases();
  } catch (e) {
    console.warn('IAP: Wiederherstellen fehlgeschlagen:', e);
  }
  return !!store.get('remove_ads', storePlatform)?.owned;
}
