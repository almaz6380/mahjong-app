#!/usr/bin/env python3
"""App Store Connect: Zustand der App anzeigen (nur lesend).

Beantwortet vor dem Einreichen die wichtigen Fragen:
  - Welche Version ist gerade in Arbeit und in welchem Zustand?
  - Hängt noch eine Prüfung (reviewSubmission) offen, die abgebrochen werden muss?
  - Ist der frisch hochgeladene Build schon verarbeitet?

Voraussetzung: ASC-API-Key ~/.appstoreconnect/private_keys/AuthKey_VGHCB8Z8Q2.p8
               sowie pyjwt + cryptography.

Aufruf:  python3 scripts/asc-status.py
Das Abbrechen einer laufenden Prüfung bleibt bewusst manuell (destruktiv):
  PATCH /v1/reviewSubmissions/{id}  {"data":{"type":"reviewSubmissions",
        "id":"<id>","attributes":{"canceled":true}}}
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

KEY_ID = 'VGHCB8Z8Q2'
ISSUER = '0d4e473b-2807-4c66-9857-6b0eb78e62ce'
APP_ID = '6787721454'
KEY_PATH = os.path.expanduser(f'~/.appstoreconnect/private_keys/AuthKey_{KEY_ID}.p8')
BASE = 'https://api.appstoreconnect.apple.com'


def token() -> str:
    try:
        import jwt  # pyjwt
    except ImportError:
        sys.exit('Fehlt: pip3 install pyjwt cryptography')
    # Wie in asc-submit.py: In der GitHub-Action kommt der Schluessel als
    # Secret in der Umgebung und landet nie auf der Platte; auf dem Mac liegt
    # er als Datei.
    private = os.environ.get('ASC_KEY_P8')
    if not private:
        if not os.path.exists(KEY_PATH):
            sys.exit(f'ASC-Key nicht gefunden: {KEY_PATH}')
        with open(KEY_PATH) as fh:
            private = fh.read()
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ.get('ASC_ISSUER_ID') or ISSUER,
         'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'},
        private,
        algorithm='ES256',
        headers={'kid': os.environ.get('ASC_KEY_ID') or KEY_ID, 'typ': 'JWT'},
    )


def get(tok, path):
    req = urllib.request.Request(BASE + path)
    req.add_header('Authorization', f'Bearer {tok}')
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'FEHLER {e.code} bei {path}\n{e.read().decode(errors="replace")}')


def main():
    tok = token()

    print('\n=== Versionen ===')
    vers = get(tok, f'/v1/apps/{APP_ID}/appStoreVersions?limit=3')
    for v in vers['data']:
        a = v['attributes']
        print(f"  {a['versionString']:8} {a['appStoreState']:28} id={v['id']}")

    print('\n=== Zuletzt hochgeladene Builds ===')
    builds = get(tok, f'/v1/builds?filter[app]={APP_ID}&limit=5&sort=-uploadedDate')
    for b in builds['data']:
        a = b['attributes']
        print(f"  Build {a.get('version', '?'):5} {a.get('processingState', '?'):12} "
              f"hochgeladen {a.get('uploadedDate', '?')[:16]}  id={b['id']}")

    print('\n=== Offene Prüfungen ===')
    subs = get(tok, f'/v1/reviewSubmissions?filter[app]={APP_ID}&limit=5')
    offen = [s for s in subs['data'] if s['attributes'].get('state') not in ('COMPLETE', 'CANCELING')]
    if not offen:
        print('  keine — der nächste Build kann direkt eingereicht werden')
    for s in offen:
        a = s['attributes']
        print(f"  {a.get('state')}  eingereicht {str(a.get('submittedDate'))[:16]}  id={s['id']}")
        print('  -> muss vor einer neuen Einreichung abgebrochen werden:')
        print(f"     PATCH /v1/reviewSubmissions/{s['id']}  {{\"canceled\": true}}")
    print()


if __name__ == '__main__':
    main()
