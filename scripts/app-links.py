#!/usr/bin/env python3
"""Einladungslinks (…/duell/CODE) direkt in der App öffnen — Einrichtung per API.

Zwei Teile, beide über die Schlüssel, die ohnehin als Repo-Secrets liegen:

  play-fingerabdruck
      Liest den SHA-256-Fingerabdruck des App-Signaturschlüssels von Google
      Play (generatedApks des aktuellen versionCode). Den braucht
      `/.well-known/assetlinks.json` (wrangler.jsonc → ANDROID_CERT_SHA256).
      Rein lesend.

  ios-profil [--faehigkeit] [--ausgabe DATEI]
      Sorgt dafür, dass die App-ID die Fähigkeit „Associated Domains" hat
      (nur mit --faehigkeit), und holt ein gültiges App-Store-Profil, das sie
      enthält — legt eines an, wenn keins da ist. Mit --ausgabe wird das
      Profil als .mobileprovision geschrieben (für den iOS-Build).

      ⚠ Eine neue Fähigkeit macht ALLE bestehenden Profile der App-ID
      ungültig — auch das im Secret IOS_PROVISIONING_PROFILE_BASE64. Deshalb
      holt sich ios-release.yml das Profil seitdem bei jedem Lauf frisch über
      diesen Befehl. Und deshalb prüft der Befehl VOR der Änderung, ob der
      Schlüssel Zertifikate und Profile überhaupt lesen darf: Ohne dieses
      Recht würde er die alten Profile entwerten und keine neuen anlegen können.

Umgebung: PLAY_KEY (Pfad zur Dienstkonto-JSON), ASC_KEY_P8/ASC_KEY_ID/ASC_ISSUER_ID.
"""

import argparse
import base64
import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))


def lade(name, datei):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HIER, datei))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BUNDLE = 'com.mahjongroyale.app'
ASC = 'https://api.appstoreconnect.apple.com'
FAEHIGKEIT = 'ASSOCIATED_DOMAINS'
MERKMAL = b'com.apple.developer.associated-domains'


# ---------------------------------------------------------------- Android ---

def versioncode() -> int:
    with open(os.path.join(HIER, '..', 'android', 'app', 'build.gradle')) as fh:
        for zeile in fh:
            z = zeile.strip()
            if z.startswith('versionCode'):
                return int(z.split()[1])
    sys.exit('versionCode nicht gefunden')


def als_doppelpunkt_hex(wert: str) -> str:
    w = wert.strip()
    # Google liefert ihn schon als „AB:CD:…" — so durchreichen.
    if ':' in w:
        return w.upper()
    if len(w) == 64 and all(c in '0123456789abcdefABCDEF' for c in w):
        roh = bytes.fromhex(w)
    else:
        roh = base64.urlsafe_b64decode(w + '=' * (-len(w) % 4))
    return ':'.join(f'{b:02X}' for b in roh)


def play_fingerabdruck():
    play = lade('play_upload', 'play-upload.py')
    tok = play.token()
    vc = versioncode()
    daten = play.call(tok, 'GET', f'{play.API}/applications/{play.PKG}/generatedApks/{vc}')
    abdruecke = []
    for eintrag in daten.get('generatedApks', []):
        h = eintrag.get('certificateSha256Hash')
        if h:
            abdruecke.append(als_doppelpunkt_hex(h))
    if not abdruecke:
        sys.exit(f'Keine Signaturdaten für versionCode {vc}:\n{json.dumps(daten, indent=2)[:2000]}')
    for a in sorted(set(abdruecke)):
        print(f'ANDROID_CERT_SHA256={a}')


# ---------------------------------------------------------------- iOS -------

def asc_anfrage(tok, methode, pfad, daten=None):
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
        return {'_fehler': e.code, '_text': e.read().decode(errors='replace')}


def pruefe(antwort, was):
    if '_fehler' in antwort:
        sys.exit(f'FEHLER {antwort["_fehler"]} bei {was}\n{antwort["_text"][:1500]}')
    return antwort


def ios_profil(faehigkeit: bool, ausgabe: str | None):
    tok = lade('asc_status', 'asc-status.py').token()

    bid = pruefe(asc_anfrage(tok, 'GET', f'/v1/bundleIds?filter[identifier]={BUNDLE}&limit=5'), 'bundleIds')
    bid = [b for b in bid['data'] if b['attributes']['identifier'] == BUNDLE]
    if not bid:
        sys.exit(f'App-ID {BUNDLE} nicht gefunden')
    bid = bid[0]['id']

    # Darf der Schlüssel Zertifikate lesen? Ohne das Recht kein Profil — dann
    # die Fähigkeit gar nicht erst anfassen (sie entwertet die alten Profile).
    certs = asc_anfrage(tok, 'GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50')
    if '_fehler' in certs:
        sys.exit(f'Der Schlüssel darf keine Zertifikate lesen ({certs["_fehler"]}). Nichts geändert.\n'
                 'In App Store Connect → Benutzer und Zugriff → Integrationen dem Schlüssel '
                 '„Zugriff auf Zertifikate, Kennungen und Profile" geben.')
    jetzt = time.strftime('%Y-%m-%dT%H:%M:%S')
    cert_ids = [c['id'] for c in certs['data'] if c['attributes'].get('expirationDate', '9') > jetzt]
    if not cert_ids:
        sys.exit('Kein gültiges Verteilungszertifikat gefunden. Nichts geändert.')

    caps = pruefe(asc_anfrage(tok, 'GET', f'/v1/bundleIds/{bid}/bundleIdCapabilities'), 'bundleIdCapabilities')
    hat = any(c['attributes'].get('capabilityType') == FAEHIGKEIT for c in caps['data'])
    print(f'Associated Domains an der App-ID: {"ja" if hat else "nein"}')
    if not hat and faehigkeit:
        pruefe(asc_anfrage(tok, 'POST', '/v1/bundleIdCapabilities', {'data': {
            'type': 'bundleIdCapabilities',
            'attributes': {'capabilityType': FAEHIGKEIT},
            'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}}},
        }}), 'Fähigkeit einschalten')
        print('→ eingeschaltet')
        hat = True

    # Ein aktives App-Store-Profil, das die Fähigkeit trägt?
    profile = pruefe(asc_anfrage(tok, 'GET', f'/v1/bundleIds/{bid}/profiles'), 'Profile')
    passend = None
    for p in profile['data']:
        a = p['attributes']
        if a.get('profileType') != 'IOS_APP_STORE' or a.get('profileState') != 'ACTIVE':
            continue
        inhalt = base64.b64decode(a.get('profileContent') or '')
        if (MERKMAL in inhalt) == hat:
            passend = (a['name'], inhalt)
            break

    if not passend:
        name = f'Mahjong Royale App Store {time.strftime("%Y-%m-%d %H%M")}'
        neu = pruefe(asc_anfrage(tok, 'POST', '/v1/profiles', {'data': {
            'type': 'profiles',
            'attributes': {'name': name, 'profileType': 'IOS_APP_STORE'},
            'relationships': {
                'bundleId': {'data': {'type': 'bundleIds', 'id': bid}},
                'certificates': {'data': [{'type': 'certificates', 'id': c} for c in cert_ids]},
            },
        }}), 'Profil anlegen')
        a = neu['data']['attributes']
        passend = (a['name'], base64.b64decode(a['profileContent']))
        print(f'→ neues Profil „{name}" angelegt')

    print(f'Profil: „{passend[0]}" — Associated Domains: {"ja" if MERKMAL in passend[1] else "nein"}')
    if ausgabe:
        os.makedirs(os.path.dirname(os.path.abspath(ausgabe)), exist_ok=True)
        with open(ausgabe, 'wb') as fh:
            fh.write(passend[1])
        print(f'geschrieben: {ausgabe}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('play-fingerabdruck')
    p = sub.add_parser('ios-profil')
    p.add_argument('--faehigkeit', action='store_true', help='Associated Domains an der App-ID einschalten')
    p.add_argument('--ausgabe', help='Profil als .mobileprovision hierhin schreiben')
    a = ap.parse_args()
    if a.cmd == 'play-fingerabdruck':
        play_fingerabdruck()
    else:
        ios_profil(a.faehigkeit, a.ausgabe)


if __name__ == '__main__':
    main()
