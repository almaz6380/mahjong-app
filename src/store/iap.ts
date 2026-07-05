import { Capacitor } from '@capacitor/core';

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
  { id: 'coins_small', label: 'shop.coins500', price: '0,99 €', coins: 500, icon: '🪙' },
  { id: 'coins_medium', label: 'shop.coins1500', price: '1,99 €', coins: 1500, icon: '💰' },
  { id: 'coins_large', label: 'shop.coins5000', price: '4,99 €', coins: 5000, icon: '💎' },
];

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
    .approved((tx: any) => tx.finish())
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
    // Web/Dev: Kauf simulieren
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
