import { Capacitor } from '@capacitor/core';

// ===========================================================================
//  In-App-Käufe (Shop)
// ===========================================================================
// - Web/Dev: simulierter Kauf, damit sich Shop & „Werbung entfernen" testen lassen.
// - Nativ: hier wird ein echtes Purchase-Plugin angebunden (z. B. RevenueCat
//   `@revenuecat/purchases-capacitor` oder `cordova-plugin-purchase`). Die
//   Produkt-IDs unten müssen dann in App Store Connect / Play Console angelegt sein.
//   Solange nichts konfiguriert ist, meldet purchase() auf nativ einen Fehler.
// ===========================================================================

export type ProductId = 'remove_ads' | 'coins_small' | 'coins_medium' | 'coins_large';

export interface Product {
  id: ProductId;
  label: string;
  price: string; // Anzeigepreis (echter Preis kommt später vom Store)
  coins?: number; // Münzen, die der Kauf gutschreibt
  removesAds?: boolean;
  icon: string;
}

export const PRODUCTS: Product[] = [
  { id: 'remove_ads', label: 'Werbung entfernen', price: '2,99 €', removesAds: true, icon: '🚫' },
  { id: 'coins_small', label: '500 Münzen', price: '0,99 €', coins: 500, icon: '🪙' },
  { id: 'coins_medium', label: '1500 Münzen', price: '1,99 €', coins: 1500, icon: '💰' },
  { id: 'coins_large', label: '5000 Münzen', price: '4,99 €', coins: 5000, icon: '💎' },
];

export interface PurchaseResult {
  ok: boolean;
  product?: Product;
  error?: string;
}

const NATIVE_STORE_READY = false; // -> auf true setzen, sobald ein Purchase-Plugin verdrahtet ist

export async function purchase(id: ProductId): Promise<PurchaseResult> {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: 'Unbekanntes Produkt' };

  if (!Capacitor.isNativePlatform()) {
    // Web/Dev: Kauf simulieren
    return { ok: true, product };
  }

  if (!NATIVE_STORE_READY) {
    return { ok: false, error: 'Store noch nicht konfiguriert (siehe README).' };
  }

  // TODO(nativ): echtes Purchase-Plugin aufrufen und Beleg verifizieren.
  return { ok: false, error: 'Kauf fehlgeschlagen.' };
}
