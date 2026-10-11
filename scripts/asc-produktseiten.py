#!/usr/bin/env python3
"""Eigene Produktseiten im App Store (Custom Product Pages) anlegen.

Eine eigene Produktseite ist eine zweite Fassung der Store-Seite mit eigenem
Werbetext, eigener Kopfzeile und — seit 2025 — eigenen Suchbegriffen: Wer
„riichi" sucht, landet auf der Riichi-Seite statt auf der allgemeinen.
Quelle ist `store/produktseiten.json`.

  python3 scripts/asc-produktseiten.py                       # nur ansehen
  python3 scripts/asc-produktseiten.py --anlegen             # Trockenlauf
  python3 scripts/asc-produktseiten.py --anlegen --schreiben # anlegen
  python3 scripts/asc-produktseiten.py --einreichen --schreiben

Screenshots werden NICHT hochgeladen: Die Seite entsteht aus der live
geschalteten Version als Vorlage (`appStoreVersionTemplate`) und übernimmt
deren Bilder. Die Kopfzeile ordnet man in App Store Connect von Hand zu.

Die Suchbegriffe müssen in den Keywords der App stehen (store-texte.json).
Ein Begriff, der dort fehlt, wird gemeldet und übersprungen — er lässt sich
erst mit der nächsten App-Version ergänzen.

Bereits vorhandene Seiten (gleicher Name) werden nicht doppelt angelegt;
Werbetext und Suchbegriffe werden dort nachgezogen.
"""
import argparse
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
APPLE_LOCALE = {'it-IT': 'it', 'ja-JP': 'ja'}

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
        text = e.read().decode(errors='replace')
        try:
            text = '; '.join(f"{x.get('title')}: {x.get('detail')}" for x in json.loads(text)['errors'])
        except Exception:
            text = text[:600]
        raise ApiFehler(f'HTTP {e.code} bei {methode} {pfad}: {text}') from None


def alle(pfad):
    """GET mit Blättern über links.next."""
    daten = []
    while pfad:
        antwort = call('GET', pfad)
        daten += antwort.get('data', [])
        naechste = antwort.get('links', {}).get('next')
        pfad = naechste[len(asc.BASE):] if naechste else None
    return daten


def live_version():
    for v in alle(f'/v1/apps/{asc.APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20'):
        if v['attributes']['appStoreState'] == 'READY_FOR_SALE':
            return v
    sys.exit('Keine live geschaltete Version gefunden (READY_FOR_SALE).')


def keyword_ids(loc_typ, loc_id):
    """Suchbegriffe einer Lokalisierung. AppKeyword hat keine Attribute —
    die id IST der Begriff (so jedenfalls die Annahme; der Lesemodus druckt
    sie aus, damit man es sieht)."""
    return [k['id'] for k in alle(f'/v1/{loc_typ}/{loc_id}/relationships/searchKeywords?limit=200')]


def zeige(version):
    print(f"Live-Version {version['attributes']['versionString']}  id={version['id']}")
    for loc in alle(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50"):
        a = loc['attributes']
        try:
            ids = keyword_ids('appStoreVersionLocalizations', loc['id'])
        except ApiFehler as e:
            ids = [f'({e})']
        print(f"  {a['locale']:6} keywords-Feld: {a.get('keywords')}")
        print(f"         searchKeywords-IDs: {ids}")
    seiten = alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50')
    print(f'\nEigene Produktseiten: {len(seiten)}')
    for s in seiten:
        a = s['attributes']
        print(f"  {a['name']!r:16} sichtbar={a.get('visible')}  {a.get('url')}")
        for v in alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10"):
            va = v['attributes']
            print(f"     Version {va.get('version')}  {va.get('state')}  id={v['id']}")
            for loc in alle(f"/v1/appCustomProductPageVersions/{v['id']}/appCustomProductPageLocalizations?limit=50"):
                try:
                    ids = keyword_ids('appCustomProductPageLocalizations', loc['id'])
                except ApiFehler as e:
                    ids = [f'({e})']
                print(f"       {loc['attributes']['locale']:6} Suchbegriffe {ids}")
    return seiten


def anlegen(cfg, version, vorhanden, schreiben):
    # Begriffe, die die App je Sprache wirklich hat — nur die lassen sich zuordnen.
    app_kw = {}
    for loc in alle(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50"):
        a = loc['attributes']
        felder = {w.strip().lower() for w in (a.get('keywords') or '').split(',') if w.strip()}
        try:
            ids = keyword_ids('appStoreVersionLocalizations', loc['id'])
        except ApiFehler:
            ids = []
        app_kw[a['locale']] = (felder, ids)

    nach_name = {s['attributes']['name']: s for s in vorhanden}
    for seite in cfg['seiten']:
        name = seite['name']
        print(f'\n=== Seite {name!r} ===')
        if name in nach_name:
            seite_id = nach_name[name]['id']
            print(f'  vorhanden (id={seite_id}) — ziehe Texte/Suchbegriffe nach')
        elif not schreiben:
            print(f"  TROCKENLAUF: würde anlegen, Vorlage = Version {version['attributes']['versionString']}")
            seite_id = None
        else:
            antwort = call('POST', '/v1/appCustomProductPages', {
                'data': {
                    'type': 'appCustomProductPages',
                    'attributes': {'name': name},
                    'relationships': {
                        'app': {'data': {'type': 'apps', 'id': asc.APP_ID}},
                        'appStoreVersionTemplate': {'data': {'type': 'appStoreVersions', 'id': version['id']}},
                        'appCustomProductPageVersions': {'data': [
                            {'type': 'appCustomProductPageVersions', 'id': '${neu-version}'}]},
                    },
                },
                'included': [
                    {'type': 'appCustomProductPageVersions', 'id': '${neu-version}',
                     'relationships': {'appCustomProductPageLocalizations': {'data': [
                         {'type': 'appCustomProductPageLocalizations', 'id': '${neu-en}'}]}}},
                    {'type': 'appCustomProductPageLocalizations', 'id': '${neu-en}',
                     'attributes': {'locale': 'en-US', 'promotionalText': seite['promo']['en-US']}},
                ],
            })
            seite_id = antwort['data']['id']
            print(f"  angelegt: id={seite_id}  {antwort['data']['attributes'].get('url')}")

        if not seite_id:
            for play_loc, promo in seite['promo'].items():
                loc = APPLE_LOCALE.get(play_loc, play_loc)
                felder, _ = app_kw.get(loc, (set(), []))
                kws = seite['keywords'].get(play_loc, [])
                fehlt = [k for k in kws if k.lower() not in felder]
                print(f'  {loc:6} Werbetext {len(promo)} Zeichen, Suchbegriffe {kws}'
                      + (f'  ⚠ nicht in den App-Keywords: {fehlt}' if fehlt else ''))
            continue

        versionen = alle(f'/v1/appCustomProductPages/{seite_id}/appCustomProductPageVersions?limit=10')
        bearbeitbar = [v for v in versionen if v['attributes'].get('state') == 'PREPARE_FOR_SUBMISSION']
        if not bearbeitbar:
            print('  keine bearbeitbare Version (schon eingereicht?) — übersprungen')
            continue
        v_id = bearbeitbar[0]['id']
        locs = {l['attributes']['locale']: l for l in
                alle(f'/v1/appCustomProductPageVersions/{v_id}/appCustomProductPageLocalizations?limit=50')}

        for play_loc, promo in seite['promo'].items():
            loc = APPLE_LOCALE.get(play_loc, play_loc)
            if len(promo) > 170:
                sys.exit(f'{name} {loc}: Werbetext {len(promo)} > 170 Zeichen')
            if loc not in locs:
                if not schreiben:
                    print(f'  {loc:6} TROCKENLAUF: würde Sprache anlegen')
                    continue
                locs[loc] = call('POST', '/v1/appCustomProductPageLocalizations', {'data': {
                    'type': 'appCustomProductPageLocalizations',
                    'attributes': {'locale': loc, 'promotionalText': promo},
                    'relationships': {'appCustomProductPageVersion': {'data': {
                        'type': 'appCustomProductPageVersions', 'id': v_id}}}}})['data']
                print(f'  {loc:6} Sprache angelegt')
            elif schreiben:
                call('PATCH', f"/v1/appCustomProductPageLocalizations/{locs[loc]['id']}", {'data': {
                    'type': 'appCustomProductPageLocalizations', 'id': locs[loc]['id'],
                    'attributes': {'promotionalText': promo}}})
                print(f'  {loc:6} Werbetext gesetzt')

            # Suchbegriffe: nur solche, die die App selbst führt.
            felder, ids = app_kw.get(loc, (set(), []))
            wunsch = seite['keywords'].get(play_loc, [])
            treffer = [i for i in ids if i.lower() in {w.lower() for w in wunsch}]
            fehlt = [w for w in wunsch if w.lower() not in felder]
            if fehlt:
                print(f'  {loc:6} ⚠ nicht in den App-Keywords, übersprungen: {fehlt}')
            if not treffer:
                print(f'  {loc:6} ⚠ keine passende Keyword-ID gefunden (IDs der App: {ids[:12]})')
                continue
            if not schreiben:
                print(f'  {loc:6} TROCKENLAUF: würde Suchbegriffe {treffer} zuordnen')
                continue
            try:
                call('POST', f"/v1/appCustomProductPageLocalizations/{locs[loc]['id']}/relationships/searchKeywords",
                     {'data': [{'type': 'appKeywords', 'id': i} for i in treffer]})
                print(f'  {loc:6} Suchbegriffe zugeordnet: {treffer}')
            except ApiFehler as e:
                print(f'  {loc:6} ⚠ Suchbegriffe nicht zugeordnet: {e}')


def einreichen(vorhanden, schreiben):
    """Alle bearbeitbaren Seiten-Versionen in EINE Prüfung packen."""
    versionen = []
    for s in vorhanden:
        for v in alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10"):
            if v['attributes'].get('state') == 'PREPARE_FOR_SUBMISSION':
                versionen.append((s['attributes']['name'], v['id']))
    if not versionen:
        print('Nichts einzureichen.')
        return
    print('Einzureichen: ' + ', '.join(n for n, _ in versionen))
    if not schreiben:
        print('TROCKENLAUF — nichts eingereicht')
        return
    # Läuft gerade eine App-Prüfung, nimmt Apple keine zweite Einreichung an.
    # Dann meldet die API 409 und es bleibt beim Hinweis.
    sub = call('POST', '/v1/reviewSubmissions', {'data': {
        'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
        'relationships': {'app': {'data': {'type': 'apps', 'id': asc.APP_ID}}}}})['data']
    for name, v_id in versionen:
        call('POST', '/v1/reviewSubmissionItems', {'data': {
            'type': 'reviewSubmissionItems', 'relationships': {
                'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub['id']}},
                'appCustomProductPageVersion': {'data': {'type': 'appCustomProductPageVersions', 'id': v_id}}}}})
        print(f'  + {name}')
    call('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {
        'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'submitted': True}}})
    print(f"Eingereicht, reviewSubmission {sub['id']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--anlegen', action='store_true')
    ap.add_argument('--einreichen', action='store_true')
    ap.add_argument('--schreiben', action='store_true', help='wirklich ändern (sonst Trockenlauf)')
    a = ap.parse_args()
    with open(os.path.join(HIER, '..', 'store', 'produktseiten.json'), encoding='utf-8') as fh:
        cfg = json.load(fh)
    version = live_version()
    vorhanden = zeige(version)
    if a.anlegen:
        anlegen(cfg, version, vorhanden, a.schreiben)
        vorhanden = alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50')
    if a.einreichen:
        einreichen(vorhanden, a.schreiben)


if __name__ == '__main__':
    try:
        main()
    except ApiFehler as e:
        sys.exit(f'FEHLER: {e}')
