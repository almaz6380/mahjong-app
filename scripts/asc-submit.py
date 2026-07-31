#!/usr/bin/env python3
"""App Store Connect: neue Version anlegen, Build zuweisen, zur Prüfung einreichen.

Macht genau die Schritte, die bisher von Hand in der Oberfläche liefen:
  1. Version <x.y.z> anlegen (oder die vorhandene editierbare weiterverwenden)
  2. „Was ist neu"-Text in allen vorhandenen Sprachen setzen
  3. den verarbeiteten Build zuweisen
  4. reviewSubmission anlegen, Version einhängen, absenden

Ohne --submit passiert NICHTS Schreibendes — dann zeigt das Skript nur, was es
täte. Das Einreichen ist der einzige nicht ohne Weiteres rückholbare Schritt
(zurücknehmen ginge per PATCH /v1/reviewSubmissions/{id} {"canceled":true}).

Aufruf:
  python3 scripts/asc-submit.py --version 1.0.2 --build 17 --notes-file <datei>
  python3 scripts/asc-submit.py --version 1.0.2 --build 17 --notes-file <datei> --submit
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
EDITABLE = {'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED',
            'INVALID_BINARY', 'WAITING_FOR_EXPORT_COMPLIANCE'}


def token() -> str:
    try:
        import jwt  # pyjwt
    except ImportError:
        sys.exit('Fehlt: pip3 install pyjwt cryptography')
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
    ap.add_argument('--version', required=True, help='z. B. 1.0.2')
    ap.add_argument('--build', required=True, help='Build-Nummer, z. B. 17')
    ap.add_argument('--notes-file', required=True, help='JSON: {"de-DE": "…", "en-US": "…"}')
    ap.add_argument('--rename-from', help='vorhandene (editierbare) Version umbenennen, z. B. 1.0.2 -> --version')
    ap.add_argument('--submit', action='store_true', help='wirklich schreiben und einreichen')
    args = ap.parse_args()

    with open(args.notes_file, encoding='utf-8') as fh:
        notes = json.load(fh)
    write = args.submit
    tag = '' if write else '  [Probelauf, nichts geschrieben]'
    tok = token()

    # --- Build finden (muss verarbeitet sein) ---
    builds = call(tok, 'GET', f'/v1/builds?filter[app]={APP_ID}&limit=10&sort=-version')['data']
    build = next((b for b in builds if b['attributes']['version'] == args.build), None)
    if not build:
        sys.exit(f'Build {args.build} nicht gefunden. Verarbeitung noch nicht durch?')
    state = build['attributes']['processingState']
    print(f'Build {args.build}: {state}  id={build["id"]}')
    if state != 'VALID':
        sys.exit(f'Build ist {state} — erst warten, bis er VALID ist.')

    # --- Version anlegen oder wiederverwenden ---
    versions = call(tok, 'GET', f'/v1/apps/{APP_ID}/appStoreVersions?limit=10')['data']
    ver = next((v for v in versions if v['attributes']['versionString'] == args.version), None)

    # Eine schon angelegte, editierbare Version umbenennen statt eine zweite
    # anzulegen — Apple erlaubt nur EINE Version in Arbeit, und die Nummer muss
    # zur CFBundleShortVersionString des Builds passen.
    if not ver and args.rename_from:
        old = next((v for v in versions if v['attributes']['versionString'] == args.rename_from), None)
        if not old:
            sys.exit(f'Version {args.rename_from} nicht gefunden.')
        st = old['attributes']['appStoreState']
        if st not in EDITABLE:
            sys.exit(f'Version {args.rename_from} ist {st} — erst die Prüfung abbrechen '
                     '(scripts/asc-cancel.py --yes).')
        print(f'Version {args.rename_from} -> {args.version} umbenennen …{tag}')
        if write:
            call(tok, 'PATCH', f'/v1/appStoreVersions/{old["id"]}', {
                'data': {'type': 'appStoreVersions', 'id': old['id'],
                         'attributes': {'versionString': args.version}},
            })
            ver = old
        else:
            return print('Probelauf endet hier.')
    if ver:
        st = ver['attributes']['appStoreState']
        print(f'Version {args.version} existiert bereits: {st}')
        if st not in EDITABLE:
            sys.exit(f'Version ist {st} und nicht editierbar.')
    else:
        print(f'Version {args.version} anlegen …{tag}')
        if write:
            ver = call(tok, 'POST', '/v1/appStoreVersions', {
                'data': {
                    'type': 'appStoreVersions',
                    'attributes': {'platform': 'IOS', 'versionString': args.version,
                                   'releaseType': 'AFTER_APPROVAL'},
                    'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}},
                },
            })['data']
        else:
            return print('Probelauf endet hier — ohne angelegte Version geht es nicht weiter.')
    vid = ver['id']

    # --- „Was ist neu" je Sprache ---
    locs = call(tok, 'GET', f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50')['data']
    print(f'Sprachen an der Version: {[l["attributes"]["locale"] for l in locs]}')
    for loc in locs:
        code = loc['attributes']['locale']
        text = notes.get(code) or notes.get(code.split('-')[0]) or notes['en-US']
        print(f'  whatsNew {code}: {text[:60]}…{tag}')
        if write:
            call(tok, 'PATCH', f'/v1/appStoreVersionLocalizations/{loc["id"]}', {
                'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id'],
                         'attributes': {'whatsNew': text}},
            })

    # --- Build zuweisen ---
    print(f'Build {args.build} der Version {args.version} zuweisen …{tag}')
    if write:
        call(tok, 'PATCH', f'/v1/appStoreVersions/{vid}/relationships/build',
             {'data': {'type': 'builds', 'id': build['id']}})

    # --- Einreichen ---
    print('Prüfung einreichen …' + tag)
    if write:
        sub = call(tok, 'POST', '/v1/reviewSubmissions', {
            'data': {'type': 'reviewSubmissions',
                     'attributes': {'platform': 'IOS'},
                     'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}},
        })['data']
        call(tok, 'POST', '/v1/reviewSubmissionItems', {
            'data': {'type': 'reviewSubmissionItems',
                     'relationships': {
                         'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub['id']}},
                         'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}},
        })
        call(tok, 'PATCH', f'/v1/reviewSubmissions/{sub["id"]}', {
            'data': {'type': 'reviewSubmissions', 'id': sub['id'],
                     'attributes': {'submitted': True}},
        })
        print(f'✅ eingereicht (reviewSubmission {sub["id"]})')


if __name__ == '__main__':
    main()
