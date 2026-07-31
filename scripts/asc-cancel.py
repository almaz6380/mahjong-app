#!/usr/bin/env python3
"""App Store Connect: laufende Prüfung abbrechen.

Destruktiv — die Version verliert ihren Platz in Apples Warteschlange und muss
neu eingereicht werden. Nach einer 4.3-Ablehnung kann das Tage kosten (siehe
CLAUDE.md, 29.7.2026). Nur nötig, wenn ein NEUER Build eingereicht werden soll:
App Store Connect erlaubt immer nur eine offene Einreichung.

Ohne --yes passiert nichts, dann zeigt das Skript nur, was es abbrechen würde.

Aufruf:  python3 scripts/asc-cancel.py [--yes]
"""
import argparse
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
    import jwt  # pyjwt
    with open(KEY_PATH) as fh:
        private = fh.read()
    now = int(time.time())
    return jwt.encode(
        {'iss': ISSUER, 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'},
        private, algorithm='ES256', headers={'kid': KEY_ID, 'typ': 'JWT'},
    )


def call(tok, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('Authorization', f'Bearer {tok}')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'FEHLER {e.code} bei {method} {path}\n{e.read().decode(errors="replace")}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--yes', action='store_true', help='wirklich abbrechen')
    args = ap.parse_args()
    tok = token()

    subs = call(tok, 'GET', f'/v1/reviewSubmissions?filter[app]={APP_ID}&filter[state]='
                            'READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=10')['data']
    if not subs:
        return print('Keine offene Prüfung — nichts abzubrechen.')
    for s in subs:
        state = s['attributes']['state']
        print(f'Offene Prüfung {s["id"]}: {state}')
        if not args.yes:
            print('  [Probelauf] --yes fehlt, nichts geändert.')
            continue
        call(tok, 'PATCH', f'/v1/reviewSubmissions/{s["id"]}', {
            'data': {'type': 'reviewSubmissions', 'id': s['id'],
                     'attributes': {'canceled': True}},
        })
        print('  ✅ abgebrochen')


if __name__ == '__main__':
    main()
