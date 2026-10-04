#!/usr/bin/env python3
"""Neue iOS-Store-Sprachen aus store/ios-locales.json anlegen.

Hintergrund: Solange eine Version in der Prüfung ist (WAITING_FOR_REVIEW /
IN_REVIEW), sperrt Apple die Metadaten — jede Anlage scheitert mit 409.
Dieses Skript deshalb NACH der Freigabe laufen lassen. Es sucht sich selbst
die aktuell bearbeitbare Version (PREPARE_FOR_SUBMISSION) bzw. legt bei
Bedarf keine an — existiert keine bearbeitbare Version, meldet es das.

Pro Sprache wird angelegt:
  - appStoreVersionLocalization: Beschreibung, Keywords, whatsNew, URLs
  - appInfoLocalization: Name + Untertitel
Bereits vorhandene Sprachen werden übersprungen (idempotent).

Aufruf:  python3 scripts/add-ios-locales.py
"""
import importlib.util
import json
import os
import urllib.error
import urllib.request

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
URL = 'https://almaz6380.github.io'

spec = importlib.util.spec_from_file_location('asc', os.path.join(SCRIPTS, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(asc.BASE + path, data=data, method=method)
    req.add_header('Authorization', f'Bearer {TOK}')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        try:
            errs = json.loads(body)['errors']
            msg = '; '.join(f"{x.get('title')}: {x.get('detail')}" for x in errs)
        except Exception:
            msg = body[:300]
        raise RuntimeError(f'HTTP {e.code}: {msg}') from None


with open(os.path.join(SCRIPTS, '..', 'store', 'ios-locales.json')) as fh:
    LOCALES = json.load(fh)

# Bearbeitbare Version finden (nach Freigabe von 1.0.1 muss ggf. erst eine
# neue Version angelegt werden — das macht dieses Skript bewusst NICHT selbst).
vers = call('GET', f'/v1/apps/{asc.APP_ID}/appStoreVersions?limit=5')
editierbar = [v for v in vers['data']
              if v['attributes']['appStoreState'] in
              ('PREPARE_FOR_SUBMISSION', 'METADATA_REJECTED', 'DEVELOPER_REJECTED')]
if not editierbar:
    zustaende = [f"{v['attributes']['versionString']}={v['attributes']['appStoreState']}"
                 for v in vers['data']]
    raise SystemExit(
        'Keine bearbeitbare Version gefunden (' + ', '.join(zustaende) + ').\n'
        'Entweder ist die Prüfung noch nicht durch, oder es muss erst eine neue '
        'Version angelegt werden (POST /v1/appStoreVersions).')
ver = editierbar[0]
VID = ver['id']
print(f"Bearbeitbare Version: {ver['attributes']['versionString']} ({VID})")

vorhandene = {l['attributes']['locale'] for l in
              call('GET', f'/v1/appStoreVersions/{VID}/appStoreVersionLocalizations?limit=20')['data']}
print(f"Vorhandene Version-Sprachen: {', '.join(sorted(vorhandene))}")

print('\n== Versions-Lokalisierungen ==')
for loc, t in LOCALES.items():
    if loc in vorhandene:
        print(f'  [{loc}] existiert schon — übersprungen')
        continue
    call('POST', '/v1/appStoreVersionLocalizations', {
        'data': {'type': 'appStoreVersionLocalizations',
                 'attributes': {'locale': loc, 'description': t['description'],
                                'keywords': t['keywords'], 'whatsNew': t['whatsNew'],
                                'supportUrl': URL, 'marketingUrl': URL},
                 'relationships': {'appStoreVersion':
                                   {'data': {'type': 'appStoreVersions', 'id': VID}}}}})
    print(f'  [{loc}] angelegt')

print('\n== App-Info (Name + Untertitel) ==')
infos = call('GET', f'/v1/apps/{asc.APP_ID}/appInfos?limit=5')
ziel = next((i['id'] for i in infos['data']
             if i['attributes'].get('appStoreState') != 'READY_FOR_SALE'), None)
if ziel is None:
    print('  kein bearbeitbares appInfo — Name/Untertitel später über die neue Version')
else:
    info_vorhanden = {l['attributes']['locale'] for l in
                      call('GET', f'/v1/appInfos/{ziel}/appInfoLocalizations?limit=20')['data']}
    for loc, t in LOCALES.items():
        if loc in info_vorhanden:
            print(f'  [{loc}] existiert schon — übersprungen')
            continue
        call('POST', '/v1/appInfoLocalizations', {
            'data': {'type': 'appInfoLocalizations',
                     'attributes': {'locale': loc, 'name': t['name'], 'subtitle': t['subtitle']},
                     'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': ziel}}}}})
        print(f'  [{loc}] angelegt')

print('\nFertig. Die neuen Sprachen erscheinen mit der nächsten eingereichten Version.')
