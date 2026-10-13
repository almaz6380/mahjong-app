#!/usr/bin/env python3
"""Kopfzeile („Kopfzeile und Suchergebnisse") per API zuordnen — App Asset Library.

Die Kopfzeilen-Bilder liegen in der Inhalts-Mediathek (App Asset Library). Ein
Bild wird einer Seite über eine „Placement" zugeordnet:
  POST /v1/appAssetLibraryPlacements
    placementType  PRODUCT_PAGE_HEADER_ASSET (bzw. APP_STORE_SEARCH_RESULTS_ASSET)
    placementGroup aus /v1/appAssetLibraryRefData (keine feste Liste)
    image          appAssetLibraryImages/<id>
    Ziel           appStoreVersionLocalization ODER appCustomProductPageLocalization

⚠ Das Ziel muss BEARBEITBAR sein. Eine freigegebene Version oder Produktseite
antwortet mit 409 STATE_ERROR.INVALID_STATE — die Kopfzeile kommt also mit der
nächsten App-Version bzw. der nächsten Produktseiten-Version.

  python3 scripts/asc-kopfzeile.py                       # nur ansehen
  python3 scripts/asc-kopfzeile.py --zuordnen            # Trockenlauf
  python3 scripts/asc-kopfzeile.py --zuordnen --schreiben
  ... --hochladen          store/app-store-kopfzeile/*.png in die Mediathek laden
  ... --neue-seitenversion freigegebene Produktseiten bekommen eine neue,
                           bearbeitbare Version (danach mit asc-produktseiten.py
                           einreichen)

Hochladen: reservieren (POST appAssetLibraryImages, category CREATIVE_ASSETS) →
Bytes an uploadOperations → PATCH {uploaded: true} (OHNE Prüfsumme, anders als
bei appScreenshots). Eine eigene Prüfung je Bild gibt es nicht: Das Bild geht
mit der Seite durch die Prüfung, auf der es liegt.

Zuordnung Bild ↔ Sprache über den Dateinamen: header-<locale>.jpg.
"""
import argparse
import time
import importlib.util
import json
import os
import re
import sys
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
APPLE_LOCALE = {'it-IT': 'it', 'ja-JP': 'ja'}
TYPEN = ['PRODUCT_PAGE_HEADER_ASSET', 'APP_STORE_SEARCH_RESULTS_ASSET']
BEARBEITBAR = {'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'METADATA_REJECTED', 'REJECTED'}

spec = importlib.util.spec_from_file_location('asc', os.path.join(HIER, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()


class ApiFehler(Exception):
    pass


def call(methode, pfad, daten=None):
    req = urllib.request.Request(asc.BASE + pfad, method=methode,
                                 data=json.dumps(daten).encode() if daten is not None else None)
    req.add_header('Authorization', f'Bearer {TOK}')
    if daten is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            roh = r.read()
            return json.loads(roh) if roh else {}
    except urllib.error.HTTPError as e:
        raise ApiFehler(f'HTTP {e.code} bei {methode} {pfad}: {e.read().decode(errors="replace")[:3000]}') from None


def alle(pfad):
    daten = []
    while pfad:
        a = call('GET', pfad)
        daten += a.get('data', [])
        n = a.get('links', {}).get('next')
        pfad = n[len(asc.BASE):] if n else None
    return daten


KOPF_DIR = os.path.join(HIER, '..', 'store', 'app-store-kopfzeile')


def hochladen(lib_id, vorhanden, schreiben):
    namen = {b['attributes'].get('fileName') for b in vorhanden
             if b['attributes'].get('state') not in ('FAILED', 'ARCHIVED')}
    neu = []
    for f in sorted(os.listdir(KOPF_DIR)):
        if not f.endswith('.png') or f in namen:
            continue
        roh = open(os.path.join(KOPF_DIR, f), 'rb').read()
        if not schreiben:
            print(f'  TROCKENLAUF: würde {f} hochladen ({len(roh)} Bytes)')
            continue
        r = call('POST', '/v1/appAssetLibraryImages', {'data': {
            'type': 'appAssetLibraryImages',
            'attributes': {'fileName': f, 'fileSize': len(roh), 'category': 'CREATIVE_ASSETS',
                           'referenceName': 'Kopfzeile ' + f[len('header-'):-len('.png')]},
            'relationships': {'assetLibrary': {'data': {'type': 'appAssetLibraries', 'id': lib_id}}}}})['data']
        for op in r['attributes']['uploadOperations']:
            teil = roh[op['offset']:op['offset'] + op['length']]
            req = urllib.request.Request(op['url'], method=op['method'], data=teil)
            for h in op.get('requestHeaders', []):
                req.add_header(h['name'], h['value'])
            with urllib.request.urlopen(req) as antwort:
                antwort.read()
        call('PATCH', f"/v1/appAssetLibraryImages/{r['id']}", {'data': {
            'type': 'appAssetLibraryImages', 'id': r['id'], 'attributes': {'uploaded': True}}})
        print(f'  {f}: hochgeladen, id={r["id"]}')
        neu.append(r['id'])
    # Verarbeitung abwarten (UPLOAD_COMPLETE → PREPARE_FOR_SUBMISSION oder FAILED)
    for bid in neu:
        for _ in range(60):
            at = call('GET', f'/v1/appAssetLibraryImages/{bid}')['data']['attributes']
            if at.get('state') != 'UPLOAD_COMPLETE' and at.get('state') != 'AWAITING_UPLOAD':
                break
            time.sleep(5)
        print(f"  {at.get('fileName')}: {at.get('state')} spec={at.get('specId')} {at.get('stateDetails') or ''}")


def neue_seitenversionen(schreiben):
    for s in alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50'):
        versionen = alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10")
        if any(v['attributes'].get('state') == 'PREPARE_FOR_SUBMISSION' for v in versionen):
            continue
        name = s['attributes']['name']
        if not schreiben:
            print(f'  TROCKENLAUF: würde für {name} eine neue Version anlegen')
            continue
        v = call('POST', '/v1/appCustomProductPageVersions', {'data': {
            'type': 'appCustomProductPageVersions',
            'relationships': {'appCustomProductPage': {'data': {'type': 'appCustomProductPages', 'id': s['id']}}}}})['data']
        locs = alle(f"/v1/appCustomProductPageVersions/{v['id']}/appCustomProductPageLocalizations?limit=50")
        print(f"  {name}: neue Version {v['attributes'].get('version')} ({v['attributes'].get('state')}), "
              f"{len(locs)} Sprachen übernommen")


def gruppen():
    """Erlaubte placementGroups je Kopfzeilen-Typ aus den Referenzdaten."""
    ref = call('GET', '/v1/appAssetLibraryRefData?filter[placementTypes]=' + ','.join(TYPEN))
    print('Referenzdaten (gekürzt):')
    print(json.dumps(ref, ensure_ascii=False)[:600])
    # Aufbau (am 13.10.2026 gelesen): features[].placementPolicies[] mit
    # placementType und groupLimits[].groupIds — für die Kopfzeile nur
    # DEFAULT_PROFILE. Bildformat: 16:9 GENAU 5244×2950 PNG (passt für Kopfzeile
    # UND Suchergebnisse) oder 21:9 3840×1646 PNG (nur Kopfzeile). Unsere ersten
    # 3840×2160-JPGs passten nur für In-App-Events.
    funde = {}
    for d in ref.get('data', []):
        for f in d['attributes'].get('features', []):
            for pol in f.get('placementPolicies', []):
                if pol.get('placementType') in TYPEN:
                    for gl in pol.get('groupLimits', []):
                        funde.setdefault(pol['placementType'], set()).update(gl.get('groupIds', []))
    return {k: sorted(v) for k, v in funde.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--zuordnen', action='store_true')
    ap.add_argument('--hochladen', action='store_true')
    ap.add_argument('--neue-seitenversion', action='store_true')
    ap.add_argument('--schreiben', action='store_true')
    a = ap.parse_args()

    lib = call('GET', f'/v1/apps/{asc.APP_ID}/assetLibrary')['data']
    bilder = alle(f"/v1/appAssetLibraries/{lib['id']}/images?filter[category]=CREATIVE_ASSETS&limit=200")
    print(f"Mediathek {lib['id']}: {len(bilder)} Kreativ-Bilder")
    nach_loc = {}
    for b in bilder:
        at = b['attributes']
        name = at.get('fileName') or at.get('referenceName') or ''
        print(f"  {name:28} {at.get('state'):22} spec={at.get('specId')} id={b['id']}")
        m = re.search(r'header-([a-z]{2}-[A-Z]{2})\.png$', name)
        if m and at.get('state') not in ('FAILED', 'REJECTED', 'ARCHIVED', 'AWAITING_UPLOAD', 'UPLOAD_COMPLETE'):
            nach_loc[APPLE_LOCALE.get(m.group(1), m.group(1))] = b

    if a.hochladen:
        hochladen(lib['id'], bilder, a.schreiben)
        if a.schreiben:
            return main_nach_upload(a)
    if a.neue_seitenversion:
        neue_seitenversionen(a.schreiben)

    g = gruppen()
    print(f'Gruppen je Typ: {g}')

    # Ziele: bearbeitbare App-Version und bearbeitbare Produktseiten-Versionen
    ziele = []
    for v in alle(f'/v1/apps/{asc.APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10'):
        st = v['attributes']['appStoreState']
        print(f"Version {v['attributes']['versionString']}: {st}")
        if st in BEARBEITBAR:
            for l in alle(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations?limit=50"):
                ziele.append(('appStoreVersionLocalization', 'appStoreVersionLocalizations', l['id'],
                              l['attributes']['locale'], f"Version {v['attributes']['versionString']}"))
    for s in alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50'):
        for v in alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10"):
            st = v['attributes'].get('state')
            print(f"Produktseite {s['attributes']['name']} v{v['attributes'].get('version')}: {st}")
            if st == 'PREPARE_FOR_SUBMISSION':
                for l in alle(f"/v1/appCustomProductPageVersions/{v['id']}/appCustomProductPageLocalizations?limit=50"):
                    ziele.append(('appCustomProductPageLocalization', 'appCustomProductPageLocalizations', l['id'],
                                  l['attributes']['locale'], f"Seite {s['attributes']['name']}"))
    print(f'Bearbeitbare Ziele: {len(ziele)}')
    if not a.zuordnen:
        return
    if not ziele:
        print('Nichts bearbeitbar — Kopfzeile kommt mit der nächsten Version.')
        return
    if not g.get('PRODUCT_PAGE_HEADER_ASSET'):
        sys.exit('Keine placementGroup für die Kopfzeile in den Referenzdaten gefunden — nichts geändert.')
    paare = [(t, gr) for t in TYPEN for gr in g.get(t, [])]
    for rel, rtyp, rid, loc, wo in ziele:
        bild = nach_loc.get(loc)
        if not bild:
            print(f'  {wo} {loc}: kein passendes PNG in der Mediathek')
            continue
        for typ, gruppe in paare:
            if not a.schreiben:
                print(f'  {wo} {loc}: TROCKENLAUF {typ}/{gruppe} ← {bild["id"][:8]}')
                continue
            try:
                call('POST', '/v1/appAssetLibraryPlacements', {'data': {
                    'type': 'appAssetLibraryPlacements',
                    'attributes': {'placementType': typ, 'placementGroup': gruppe},
                    'relationships': {
                        'image': {'data': {'type': 'appAssetLibraryImages', 'id': bild['id']}},
                        rel: {'data': {'type': rtyp, 'id': rid}}}}})
                print(f'  {wo} {loc}: zugeordnet ({gruppe})')
            except ApiFehler as e:
                print(f'  {wo} {loc}: ⚠ {e}')


def main_nach_upload(a):
    # Nach dem Hochladen den Rest mit frischem Stand, ohne erneuten Upload.
    a.hochladen = False
    sys.argv = [sys.argv[0]] + (['--zuordnen'] if a.zuordnen else []) \
        + (['--neue-seitenversion'] if a.neue_seitenversion else []) + ['--schreiben']
    return main()


if __name__ == '__main__':
    try:
        main()
    except ApiFehler as e:
        sys.exit(f'FEHLER: {e}')
