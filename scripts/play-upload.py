#!/usr/bin/env python3
"""AAB zu Google Play hochladen und im Produktions-Track veröffentlichen.

Nur Standardbibliothek + pyjwt/cryptography (kein google-api-python-client).
Dienstkonto-Key: ~/.config/play-publisher/key.json
  (play-upload@wellbooked-501311.iam.gserviceaccount.com, braucht Admin-Recht
   für die App — sonst kommt 403 PERMISSION_DENIED.)

Ablauf (eine Edit-Transaktion):
  edits.insert -> bundles.upload -> tracks.update -> :validate -> :commit

Beispiele:
  # gestufte Veröffentlichung an 20 % der Nutzer (empfohlen für den ersten Tag)
  python3 scripts/play-upload.py --aab app-release.aab --fraction 0.2 \
      --notes "Levelwechsel repariert, Werbung verdeckt die Knöpfe nicht mehr."

  # später auf alle ausweiten (ohne neues AAB)
  python3 scripts/play-upload.py --promote 15 --complete

  # nur nachsehen, was gerade im Produktions-Track liegt
  python3 scripts/play-upload.py --status
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PKG = 'com.mahjongroyale.app'
KEY = os.path.expanduser('~/.config/play-publisher/key.json')
API = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3'


def token() -> str:
    """Dienstkonto-JWT gegen ein Bearer-Token tauschen."""
    try:
        import jwt  # pyjwt
    except ImportError:
        sys.exit('Fehlt: pip3 install pyjwt cryptography')
    if not os.path.exists(KEY):
        sys.exit(f'Dienstkonto-Key nicht gefunden: {KEY}')
    with open(KEY) as fh:
        k = json.load(fh)
    now = int(time.time())
    assertion = jwt.encode(
        {
            'iss': k['client_email'],
            'scope': 'https://www.googleapis.com/auth/androidpublisher',
            'aud': 'https://oauth2.googleapis.com/token',
            'iat': now,
            'exp': now + 3600,
        },
        k['private_key'],
        algorithm='RS256',
    )
    body = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': assertion,
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=body)
    with urllib.request.urlopen(req) as r:
        return json.load(r)['access_token']


def call(tok, method, url, data=None, ctype='application/json'):
    if data is not None and ctype == 'application/json':
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {tok}')
    if data is not None:
        req.add_header('Content-Type', ctype)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors='replace')
        sys.exit(f'\nFEHLER {e.code} bei {method} {url}\n{detail}\n')


def zeige_status(tok):
    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    tr = call(tok, 'GET', f'{API}/applications/{PKG}/edits/{eid}/tracks/production')
    call(tok, 'DELETE', f'{API}/applications/{PKG}/edits/{eid}')  # Edit verwerfen
    print(json.dumps(tr, indent=2, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--aab', help='Pfad zur .aab (Neu-Upload)')
    p.add_argument('--promote', type=int, metavar='VERSIONCODE',
                   help='vorhandenen versionCode weiter ausrollen (ohne Upload)')
    p.add_argument('--fraction', type=float, help='Anteil der Nutzer, z. B. 0.2')
    p.add_argument('--complete', action='store_true', help='an alle ausrollen')
    p.add_argument('--notes', default='', help='Was-ist-neu-Text (de-DE)')
    p.add_argument('--status', action='store_true', help='nur Produktions-Track anzeigen')
    a = p.parse_args()

    if not (a.aab or a.promote or a.status):
        p.error('--aab, --promote oder --status angeben')
    if a.aab and not a.complete and a.fraction is None:
        p.error('--fraction 0.2 oder --complete angeben')

    tok = token()
    if a.status:
        return zeige_status(tok)

    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    print(f'Edit {eid} geöffnet')

    vc = a.promote
    if a.aab:
        with open(a.aab, 'rb') as fh:
            blob = fh.read()
        print(f'Lade {a.aab} hoch ({len(blob) / 1e6:.1f} MB) …')
        res = call(tok, 'POST', f'{UPLOAD}/applications/{PKG}/edits/{eid}/bundles?uploadType=media',
                   data=blob, ctype='application/octet-stream')
        vc = res['versionCode']
        print(f'  hochgeladen als versionCode {vc}')

    release = {'name': f'{vc} (1.0)', 'versionCodes': [str(vc)]}
    if a.complete:
        release['status'] = 'completed'
    else:
        release['status'] = 'inProgress'
        release['userFraction'] = a.fraction
    if a.notes:
        release['releaseNotes'] = [{'language': 'de-DE', 'text': a.notes}]

    call(tok, 'PUT', f'{API}/applications/{PKG}/edits/{eid}/tracks/production',
         data={'track': 'production', 'releases': [release]})
    ziel = 'alle Nutzer' if a.complete else f'{a.fraction * 100:.0f} % der Nutzer'
    print(f'Track production gesetzt: versionCode {vc} an {ziel}')

    call(tok, 'POST', f'{API}/applications/{PKG}/edits/{eid}:validate')
    print('validiert')
    call(tok, 'POST', f'{API}/applications/{PKG}/edits/{eid}:commit')
    print('✅ veröffentlicht')


if __name__ == '__main__':
    main()
