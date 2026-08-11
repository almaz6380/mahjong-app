#!/usr/bin/env python3
"""Store-Beschreibung, Keywords und Untertitel bei Apple AKTUALISIEREN.

Abgrenzung zu `add-ios-locales.py`: Das legt neue Sprachen an und überspringt
vorhandene (rein additiv). Es kann bestehende Texte also nicht ändern — genau
das macht dieses Skript hier, per PATCH.

Quelle ist `store/store-texte.json`, dieselbe Datei, aus der auch der
Play-Eintrag gespeist wird. Die Schlüssel dort sind Play-Sprachcodes; Apple
führt Italienisch und Japanisch OHNE Länderteil. Diese Umsetzung passiert in
APPLE_LOCALE — sie ist schon zweimal Ursache dafür gewesen, dass still der
englische Text stehen blieb (siehe CLAUDE.md, Falle bei 1.0.4).

⚠ Apple sperrt die Metadaten, solange eine Version in der Prüfung steht: jeder
Schreibzugriff endet dann mit 409. Das Skript sucht deshalb eine BEARBEITBARE
Version und bricht sonst mit einer klaren Meldung ab.

Aufruf:
  python3 scripts/asc-texte.py               # Trockenlauf, schreibt nichts
  python3 scripts/asc-texte.py --schreiben   # setzt die Texte
"""
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
URL = 'https://mahjong-app-plum.vercel.app'
SCHREIBEN = '--schreiben' in sys.argv

# Play-Code -> Apple-Code. Nur diese beiden weichen ab.
APPLE_LOCALE = {'it-IT': 'it', 'ja-JP': 'ja'}

# Beide Stores weisen Überlänge erst beim Schreiben ab, mit unklaren Meldungen.
GRENZEN = {'name': 30, 'subtitle': 30, 'keywords': 100, 'description': 4000}

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


with open(os.path.join(SCRIPTS, '..', 'store', 'store-texte.json'), encoding='utf-8') as fh:
    ROH = json.load(fh)
TEXTE = {APPLE_LOCALE.get(k, k): v for k, v in ROH.items() if not k.startswith('_')}

# Längen zuerst, bevor irgendetwas geschrieben wird — ein halb gesetzter
# Sprachsatz ist schlimmer als gar keiner.
fehler = [f'{loc} {feld}: {len(t[feld])} > {mx}'
          for loc, t in TEXTE.items() for feld, mx in GRENZEN.items() if len(t[feld]) > mx]
if fehler:
    raise SystemExit('Zu lang:\n  ' + '\n  '.join(fehler))
print(f'Längen geprüft: {len(TEXTE)} Sprachen in Ordnung')

vers = call('GET', f'/v1/apps/{asc.APP_ID}/appStoreVersions?limit=5')
editierbar = [v for v in vers['data']
              if v['attributes']['appStoreState'] in
              ('PREPARE_FOR_SUBMISSION', 'METADATA_REJECTED', 'DEVELOPER_REJECTED')]
if not editierbar:
    zustaende = [f"{v['attributes']['versionString']}={v['attributes']['appStoreState']}"
                 for v in vers['data']]
    raise SystemExit(
        'Keine bearbeitbare Version (' + ', '.join(zustaende) + ').\n'
        'Solange eine Prüfung läuft, sind die Metadaten gesperrt — erst\n'
        'abbrechen (asc-submit.yml, zuerst_abbrechen), dann erneut versuchen.')
ver = editierbar[0]
VID = ver['id']
print(f"Bearbeitbare Version: {ver['attributes']['versionString']} ({VID})"
      f" — {ver['attributes']['appStoreState']}")
if not SCHREIBEN:
    print('\n*** TROCKENLAUF — es wird nichts geschrieben (--schreiben zum Setzen) ***')

print('\n== Beschreibung + Keywords ==')
loks = call('GET', f'/v1/appStoreVersions/{VID}/appStoreVersionLocalizations?limit=20')['data']
vorhanden = {l['attributes']['locale']: l['id'] for l in loks}
for loc, t in TEXTE.items():
    if loc not in vorhanden:
        print(f'  [{loc}] FEHLT an der Version — mit add-ios-locales.py anlegen')
        continue
    if SCHREIBEN:
        call('PATCH', f'/v1/appStoreVersionLocalizations/{vorhanden[loc]}', {
            'data': {'type': 'appStoreVersionLocalizations', 'id': vorhanden[loc],
                     'attributes': {'description': t['description'],
                                    'keywords': t['keywords'],
                                    'supportUrl': URL, 'marketingUrl': URL}}})
    print(f"  [{loc}] {'gesetzt' if SCHREIBEN else 'würde gesetzt'} — "
          f"{len(t['description'])} Zeichen, Keywords {len(t['keywords'])}")

print('\n== Name + Untertitel ==')
infos = call('GET', f'/v1/apps/{asc.APP_ID}/appInfos?limit=5')
ziel = next((i['id'] for i in infos['data']
             if i['attributes'].get('appStoreState') != 'READY_FOR_SALE'), None)
if ziel is None:
    print('  kein bearbeitbares appInfo — Name und Untertitel bleiben, wie sie sind')
else:
    il = call('GET', f'/v1/appInfos/{ziel}/appInfoLocalizations?limit=20')['data']
    ivorh = {l['attributes']['locale']: l['id'] for l in il}
    for loc, t in TEXTE.items():
        if loc not in ivorh:
            print(f'  [{loc}] FEHLT im App-Info — mit add-ios-locales.py anlegen')
            continue
        if SCHREIBEN:
            call('PATCH', f'/v1/appInfoLocalizations/{ivorh[loc]}', {
                'data': {'type': 'appInfoLocalizations', 'id': ivorh[loc],
                         'attributes': {'name': t['name'], 'subtitle': t['subtitle']}}})
        print(f"  [{loc}] {'gesetzt' if SCHREIBEN else 'würde gesetzt'} — „{t['subtitle']}\"")

print('\nFertig.' if SCHREIBEN else '\nTrockenlauf beendet — nichts geändert.')
