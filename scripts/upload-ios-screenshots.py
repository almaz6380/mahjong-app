#!/usr/bin/env python3
"""Screenshots für iOS-Sprachfassungen hochladen (3-Schritt-Upload der ASC-API).

Apple verlangt Screenshots je Lokalisierung — fehlen sie, lässt sich die Version
nicht einreichen. Dieses Skript füllt sie aus store/ios-screenshots/: für de-DE
aus den deutschen Ordnern, für alle anderen Sprachen aus den englischen.

⚠ Die Bilder MÜSSEN vor dem Einreichen hoch. Sobald die Version in der Prüfung
ist, sperrt Apple die Metadaten und antwortet auf jeden POST mit 409.

Ablauf je Bild (ASC-API):
  POST /v1/appScreenshots {fileName, fileSize, appScreenshotSet}
  → PUT der Bytes an die uploadOperations-URL
  → PATCH {uploaded: true, sourceFileChecksum: <md5>}

Aufruf:  python3 scripts/upload-ios-screenshots.py [--ersetzen] [locale ...]
         (ohne Locale: alle Sprachen der Version)

Ohne --ersetzen werden Sprachfassungen, die schon Bilder haben, ÜBERSPRUNGEN —
das Skript füllt dann nur Lücken. Mit --ersetzen löscht es die vorhandenen
Bilder je Satz und lädt neu; das ist der Weg, wenn sich das Aussehen der App
geändert hat.
"""
import hashlib
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(SCRIPTS)
SHOTS = os.path.join(REPO, 'store', 'ios-screenshots')

# Anzeigetyp → Ordner-Grundname. Die Bilder tragen UI-Text, sind also NICHT
# sprachneutral: für de-DE die deutschen Sätze, für alle anderen die englischen.
# (Für es/pt/fr/it/ja gibt es keine eigenen — Englisch ist dort das Beste, was
# wir haben.) Ein früherer Kommentar nannte die Bilder sprachneutral; das galt,
# solange nur Spielbretter zu sehen waren.
SETS = {
    'APP_IPHONE_65': ('iphone65', 'iphone65-en'),
    'APP_IPAD_PRO_3GEN_129': ('ipad13', 'ipad13-en'),
}


def ordner(typ: str, locale: str) -> str:
    deutsch, englisch = SETS[typ]
    return deutsch if locale == 'de-DE' else englisch

spec = importlib.util.spec_from_file_location('asc', os.path.join(SCRIPTS, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()


def call(method, path_or_url, payload=None, raw=None, headers=None):
    url = path_or_url if path_or_url.startswith('http') else asc.BASE + path_or_url
    data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    if not path_or_url.startswith('http'):
        req.add_header('Authorization', f'Bearer {TOK}')
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if payload is not None and raw is None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return json.loads(body) if body and body[:1] in (b'{', b'[') else {}
    except urllib.error.HTTPError as e:
        b = e.read().decode(errors='replace')
        try:
            errs = json.loads(b)['errors']
            msg = '; '.join(f"{x.get('title')}: {x.get('detail')}" for x in errs)
        except Exception:
            msg = b[:300]
        raise RuntimeError(f'HTTP {e.code} bei {method} {path_or_url[:70]} — {msg}') from None


vers = call('GET', f'/v1/apps/{asc.APP_ID}/appStoreVersions?limit=5')
editierbar = [v for v in vers['data'] if v['attributes']['appStoreState'] in
              ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'METADATA_REJECTED')]
if not editierbar:
    raise SystemExit('Keine bearbeitbare Version — läuft gerade eine Prüfung?')
VID = editierbar[0]['id']
print(f"Version {editierbar[0]['attributes']['versionString']} ({VID})")

argv = sys.argv[1:]
# --ersetzen: vorhandene Bilder löschen statt die Sprache zu überspringen.
# Ohne das Flag bleibt das ursprüngliche Verhalten („neue Sprache auffüllen"),
# damit ein versehentlicher Lauf nie eine fertige Store-Seite leerräumt.
ERSETZEN = '--ersetzen' in argv
nur = set(a for a in argv if not a.startswith('--'))
locs = call('GET', f'/v1/appStoreVersions/{VID}/appStoreVersionLocalizations?limit=20')['data']
print('Modus:', 'ERSETZEN (alte Bilder werden gelöscht)' if ERSETZEN else 'nur fehlende auffüllen')

for l in locs:
    loc = l['attributes']['locale']
    if nur and loc not in nur:
        continue
    vorhandene = call('GET', f"/v1/appStoreVersionLocalizations/{l['id']}/appScreenshotSets?limit=20")
    bestand = {}
    schon = 0
    for s in vorhandene['data']:
        drin = call('GET', f"/v1/appScreenshotSets/{s['id']}/appScreenshots?limit=20")['data']
        bestand[s['id']] = drin
        schon += len(drin)
    if schon and not ERSETZEN:
        print(f'  [{loc}] hat schon {schon} Screenshots — übersprungen')
        continue

    print(f'  [{loc}]')
    vorhandene_typen = {s['attributes']['screenshotDisplayType']: s['id'] for s in vorhandene['data']}
    for typ in SETS:
        sid = vorhandene_typen.get(typ)
        if not sid:
            sid = call('POST', '/v1/appScreenshotSets', {
                'data': {'type': 'appScreenshotSets',
                         'attributes': {'screenshotDisplayType': typ},
                         'relationships': {'appStoreVersionLocalization': {
                             'data': {'type': 'appStoreVersionLocalizations', 'id': l['id']}}}}})['data']['id']
        elif ERSETZEN:
            # Bewusst je Set direkt vor dem Hochladen löschen, nicht global
            # vorab: Bricht der Upload ab, fehlen dann nur die Bilder EINES
            # Satzes und nicht die der ganzen Sprache.
            for alt in bestand.get(sid, []):
                call('DELETE', f"/v1/appScreenshots/{alt['id']}")
            if bestand.get(sid):
                print(f'    {typ}: {len(bestand[sid])} alte gelöscht')
        pfad = os.path.join(SHOTS, ordner(typ, loc))
        dateien = sorted(f for f in os.listdir(pfad) if f.endswith('.png'))
        for name in dateien:
            voll = os.path.join(pfad, name)
            roh = open(voll, 'rb').read()
            r = call('POST', '/v1/appScreenshots', {
                'data': {'type': 'appScreenshots',
                         'attributes': {'fileName': name, 'fileSize': len(roh)},
                         'relationships': {'appScreenshotSet': {
                             'data': {'type': 'appScreenshotSets', 'id': sid}}}}})
            sid_shot = r['data']['id']
            op = r['data']['attributes']['uploadOperations'][0]
            kopf = {h['name']: h['value'] for h in op.get('requestHeaders', [])}
            call(op['method'], op['url'], raw=roh, headers=kopf)
            call('PATCH', f'/v1/appScreenshots/{sid_shot}', {
                'data': {'type': 'appScreenshots', 'id': sid_shot,
                         'attributes': {'uploaded': True,
                                        'sourceFileChecksum': hashlib.md5(roh).hexdigest()}}})
        print(f'    {typ}: {len(dateien)} Bilder')

print('\nFertig.')
