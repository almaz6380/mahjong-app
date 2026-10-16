#!/usr/bin/env python3
"""In-App-Käufe bei Apple ansehen (nur lesend).

Anlass: 1.4.1 (Build 32) wurde am 15.10.2026 nach 2.1(b) abgelehnt — „the app
includes references to shop purchases but the associated In-App Purchase
products have not been submitted for review". Das Skript zeigt je Produkt
Zustand, Sprachen, Preis und ob ein Prüf-Screenshot hinterlegt ist.
"""
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

EINREICHEN = '--einreichen' in sys.argv

HIER = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('asc', os.path.join(HIER, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()


def post(pfad, daten):
    req = urllib.request.Request(asc.BASE + pfad, method='POST', data=json.dumps(daten).encode())
    req.add_header('Authorization', f'Bearer {TOK}')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {'_fehler': f'HTTP {e.code}: {e.read().decode(errors="replace")[:1500]}'}


def get(pfad):
    req = urllib.request.Request(asc.BASE + pfad)
    req.add_header('Authorization', f'Bearer {TOK}')
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {'_fehler': f'HTTP {e.code}: {e.read().decode(errors="replace")[:400]}'}


iaps = get(f'/v1/apps/{asc.APP_ID}/inAppPurchasesV2?limit=50')
if '_fehler' in iaps:
    sys.exit(iaps['_fehler'])
print(f"In-App-Käufe: {len(iaps.get('data', []))}")
for p in iaps.get('data', []):
    a = p['attributes']
    print(f"\n{a.get('productId'):14} {a.get('inAppPurchaseType'):14} Zustand={a.get('state')}  "
          f"name={a.get('name')!r} id={p['id']}")
    print(f"  Prüfhinweis: {a.get('reviewNote')!r}")
    loks = get(f"/v2/inAppPurchases/{p['id']}/inAppPurchaseLocalizations?limit=50")
    for l in loks.get('data', []):
        la = l['attributes']
        print(f"  {la.get('locale'):6} {la.get('state'):24} „{la.get('name')}“ – {la.get('description')}")
    shot = get(f"/v2/inAppPurchases/{p['id']}/appStoreReviewScreenshot")
    d = shot.get('data')
    print(f"  Prüf-Screenshot: {'ja, ' + str(d['attributes'].get('assetDeliveryState')) if d else 'FEHLT'}")
    preis = get(f"/v2/inAppPurchases/{p['id']}/iapPriceSchedule")
    print(f"  Preisplan: {'ja' if preis.get('data') else 'FEHLT ' + preis.get('_fehler', '')}")
    verf = get(f"/v2/inAppPurchases/{p['id']}/inAppPurchaseAvailability")
    print(f"  Verfügbarkeit: {'ja' if verf.get('data') else 'FEHLT ' + verf.get('_fehler', '')[:120]}")

# --einreichen: jedes Produkt im Zustand READY_TO_SUBMIT zur Prüfung schicken.
# Die ERSTEN Käufe einer App prüft Apple nur zusammen mit einer App-Version —
# deshalb läuft dieser Schritt in asc-submit.yml direkt VOR dem Einreichen der
# Version (Schalter `iap`).
if EINREICHEN:
    fehler = 0
    for p in iaps.get('data', []):
        if p['attributes'].get('state') != 'READY_TO_SUBMIT':
            continue
        r = post('/v1/inAppPurchaseSubmissions', {'data': {
            'type': 'inAppPurchaseSubmissions',
            'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': p['id']}}}}})
        if '_fehler' in r:
            fehler += 1
            print(f"⚠ {p['attributes']['productId']}: {r['_fehler']}")
        else:
            print(f"eingereicht: {p['attributes']['productId']}")
    if fehler:
        sys.exit(f'{fehler} Produkt(e) nicht eingereicht')
