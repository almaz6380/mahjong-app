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

Zuordnung Bild ↔ Sprache über den Dateinamen: header-<locale>.jpg.
"""
import argparse
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


def gruppen():
    """Erlaubte placementGroups je Kopfzeilen-Typ aus den Referenzdaten."""
    ref = call('GET', '/v1/appAssetLibraryRefData?filter[placementTypes]=' + ','.join(TYPEN))
    print('Referenzdaten (gekürzt):')
    print(json.dumps(ref, ensure_ascii=False)[:3000])
    funde = {}
    def such(o):
        if isinstance(o, dict):
            t = o.get('placementType')
            g = o.get('placementGroup') or o.get('group')
            if t in TYPEN and isinstance(g, str):
                funde.setdefault(t, set()).add(g)
            for v in o.values():
                such(v)
        elif isinstance(o, list):
            for v in o:
                such(v)
    such(ref)
    return {k: sorted(v) for k, v in funde.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--zuordnen', action='store_true')
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
        m = re.search(r'header-([a-z]{2}-[A-Z]{2})', name)
        if m and at.get('state') not in ('FAILED', 'REJECTED', 'ARCHIVED'):
            nach_loc[APPLE_LOCALE.get(m.group(1), m.group(1))] = b

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
    typ = 'PRODUCT_PAGE_HEADER_ASSET'
    if not g.get(typ):
        sys.exit(f'Keine placementGroup für {typ} in den Referenzdaten gefunden — nichts geändert.')
    for rel, rtyp, rid, loc, wo in ziele:
        bild = nach_loc.get(loc)
        if not bild:
            print(f'  {wo} {loc}: kein Bild in der Mediathek')
            continue
        for gruppe in g[typ]:
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


if __name__ == '__main__':
    try:
        main()
    except ApiFehler as e:
        sys.exit(f'FEHLER: {e}')
