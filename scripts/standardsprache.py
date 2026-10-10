#!/usr/bin/env python3
"""Standardsprache der Store-Einträge ansehen und umstellen (Apple + Play).

Die Standardsprache ist die, die ein Store zeigt, wenn es für das Land des
Besuchers keine eigene Fassung gibt — bei uns also z. B. in den Niederlanden,
Polen oder Schweden. Bis 10.10.2026 war das bei beiden Stores Deutsch.

  python3 scripts/standardsprache.py                       # nur ansehen
  python3 scripts/standardsprache.py --setze en-US         # Trockenlauf
  python3 scripts/standardsprache.py --setze en-US --schreiben
  ... --ziel nur-apple | nur-play                         # nur eine Seite

Apple: Attribut `primaryLocale` am App-Datensatz (/v1/apps/{id}).
Play:  `defaultLanguage` in den App-Details, per Edit-Transaktion.

Die Zielsprache muss im jeweiligen Store schon als vollständige Fassung
existieren — das prüft das Skript vorher und bricht sonst ab, ohne etwas zu
ändern.

Umgebung wie die übrigen Skripte: ASC_KEY_P8/ASC_KEY_ID/ASC_ISSUER_ID für
Apple, PLAY_KEY (Pfad zur Dienstkonto-JSON) für Play.
"""

import argparse
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
ASC = 'https://api.appstoreconnect.apple.com'


def lade(name, datei):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HIER, datei))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- Apple -----

def asc(tok, methode, pfad, daten=None):
    req = urllib.request.Request(ASC + pfad, method=methode,
                                 data=json.dumps(daten).encode() if daten is not None else None)
    req.add_header('Authorization', f'Bearer {tok}')
    if daten is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            roh = r.read()
            return json.loads(roh) if roh else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'FEHLER {e.code} bei {methode} {pfad}\n{e.read().decode(errors="replace")[:1500]}')


def apple(ziel_sprache, schreiben):
    status = lade('asc_status', 'asc-status.py')
    tok = status.token()
    app_id = status.APP_ID
    app = asc(tok, 'GET', f'/v1/apps/{app_id}')
    jetzt = app['data']['attributes'].get('primaryLocale')
    print(f'Apple  Standardsprache: {jetzt}')

    # Sprachen der App-Informationen (Name/Untertitel) — die Zielsprache muss
    # dort vorhanden sein, sonst gäbe es für sie keinen Namen.
    infos = asc(tok, 'GET', f'/v1/apps/{app_id}/appInfos')
    vorhanden = set()
    for info in infos['data']:
        loks = asc(tok, 'GET', f'/v1/appInfos/{info["id"]}/appInfoLocalizations?limit=50')
        vorhanden |= {l['attributes']['locale'] for l in loks['data']}
    print(f'       Sprachen vorhanden: {", ".join(sorted(vorhanden))}')

    if not ziel_sprache:
        return
    if ziel_sprache == jetzt:
        print(f'       → steht schon auf {ziel_sprache}, nichts zu tun')
        return
    if ziel_sprache not in vorhanden:
        sys.exit(f'       → {ziel_sprache} ist bei Apple nicht angelegt. Nichts geändert.')
    if not schreiben:
        print(f'       → TROCKENLAUF: würde {jetzt} → {ziel_sprache} setzen')
        return
    asc(tok, 'PATCH', f'/v1/apps/{app_id}', {'data': {
        'type': 'apps', 'id': app_id, 'attributes': {'primaryLocale': ziel_sprache}}})
    neu = asc(tok, 'GET', f'/v1/apps/{app_id}')['data']['attributes'].get('primaryLocale')
    print(f'       → gesetzt, Apple meldet jetzt: {neu}')


# ---------------------------------------------------------------- Play ------

def play(ziel_sprache, schreiben):
    p = lade('play_upload', 'play-upload.py')
    tok = p.token()
    basis = f'{p.API}/applications/{p.PKG}'
    eid = p.call(tok, 'POST', f'{basis}/edits', {})['id']
    try:
        details = p.call(tok, 'GET', f'{basis}/edits/{eid}/details')
        jetzt = details.get('defaultLanguage')
        print(f'Play   Standardsprache: {jetzt}')
        listings = p.call(tok, 'GET', f'{basis}/edits/{eid}/listings').get('listings', [])
        vorhanden = {l['language'] for l in listings}
        print(f'       Sprachen vorhanden: {", ".join(sorted(vorhanden))}')

        if not ziel_sprache or ziel_sprache == jetzt or not schreiben:
            if ziel_sprache == jetzt:
                print(f'       → steht schon auf {ziel_sprache}, nichts zu tun')
            elif ziel_sprache and ziel_sprache not in vorhanden:
                sys.exit(f'       → {ziel_sprache} hat bei Play keinen Eintrag. Nichts geändert.')
            elif ziel_sprache:
                print(f'       → TROCKENLAUF: würde {jetzt} → {ziel_sprache} setzen')
            return
        if ziel_sprache not in vorhanden:
            sys.exit(f'       → {ziel_sprache} hat bei Play keinen Eintrag. Nichts geändert.')
        p.call(tok, 'PATCH', f'{basis}/edits/{eid}/details', {'defaultLanguage': ziel_sprache})
        p.commit_edit(tok, eid)
        eid = None
        print(f'       → gesetzt ({jetzt} → {ziel_sprache}), Edit committet')
    finally:
        if eid:
            # Nur gelesen oder Trockenlauf: Edit verwerfen statt liegen lassen.
            try:
                p.call(tok, 'DELETE', f'{basis}/edits/{eid}', fatal=False)
            except p.ApiError:
                pass  # verfaellt ohnehin nach einiger Zeit


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--setze', help='Zielsprache, z. B. en-US')
    ap.add_argument('--ziel', choices=['beide', 'nur-apple', 'nur-play'], default='beide')
    ap.add_argument('--schreiben', action='store_true', help='wirklich ändern (sonst Trockenlauf)')
    a = ap.parse_args()
    if a.ziel != 'nur-play':
        apple(a.setze, a.schreiben)
    if a.ziel != 'nur-apple':
        play(a.setze, a.schreiben)


if __name__ == '__main__':
    main()
