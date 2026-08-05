#!/usr/bin/env python3
"""AAB zu Google Play hochladen und im Produktions-Track veröffentlichen.

Nur Standardbibliothek + pyjwt/cryptography (kein google-api-python-client).
Dienstkonto-Key: ~/.config/play-publisher/key.json
  (play-upload@wellbooked-501311.iam.gserviceaccount.com, braucht Admin-Recht
   für die App — sonst kommt 403 PERMISSION_DENIED.)

Ablauf (eine Edit-Transaktion):
  edits.insert -> bundles.upload -> tracks.update -> :validate -> :commit

Beispiele:
  # an alle Nutzer veröffentlichen (Standardweg)
  python3 scripts/play-upload.py --aab app-release.aab --complete \
      --notes "Levelwechsel repariert, Werbung verdeckt die Knöpfe nicht mehr."

  # optional gestuft: erst 20 %, später auf alle ausweiten (ohne neues AAB)
  python3 scripts/play-upload.py --aab app-release.aab --fraction 0.2
  python3 scripts/play-upload.py --promote 15 --complete

  # nur nachsehen, was gerade im Produktions-Track liegt
  python3 scripts/play-upload.py --status
"""
import argparse
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PKG = os.environ.get('PLAY_PACKAGE') or 'com.mahjongroyale.app'
# Pfad zum Dienstkonto-Key; in der CI über die Umgebungsvariable PLAY_KEY gesetzt.
KEY = os.environ.get('PLAY_KEY') or os.path.expanduser('~/.config/play-publisher/key.json')
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


class ApiError(Exception):
    def __init__(self, code, detail):
        super().__init__(f'{code}: {detail}')
        self.code, self.detail = code, detail


def call(tok, method, url, data=None, ctype='application/json', fatal=True):
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
        if not fatal:
            raise ApiError(e.code, detail) from None
        sys.exit(f'\nFEHLER {e.code} bei {method} {url}\n{detail}\n')


def commit_edit(tok, eid):
    """Edit pruefen und abschliessen.

    Normalerweise reicht Google die Aenderung gleich zur Pruefung ein. Steht die
    App aber unter einer laufenden Richtlinienpruefung, lehnt die API genau das
    ab (400, "Changes cannot be sent for review automatically") — und zwar schon
    bei :validate, nicht erst bei :commit. Deshalb wird der ganze Abschluss
    wiederholt, beide Aufrufe mit changesNotSentForReview=true.

    Die Aenderung ist dann gespeichert, liegt aber als Entwurf in der Play
    Console und muss dort von Hand zur Pruefung geschickt werden.

    Ohne diesen Zweig verfaellt die Edit-Transaktion und die ganze vorherige
    Arbeit (bei einem AAB: Minuten an Upload) ist weg.
    """
    basis = f'{API}/applications/{PKG}/edits/{eid}'

    def blockiert(e):
        return e.code == 400 and 'changesNotSentForReview' in e.detail

    def hart_raus(e, stufe):
        sys.exit(f'\nFEHLER {e.code} bei {stufe} von Edit {eid}\n{e.detail}\n')

    # :validate nimmt changesNotSentForReview NICHT entgegen ("could not be found
    # in request message"). Der 400er dort heisst also nur: Vorpruefung geht
    # gerade nicht — dann ohne sie weiter, direkt zum Commit.
    ohne_pruefung = False
    try:
        call(tok, 'POST', f'{basis}:validate', fatal=False)
        print('  validiert')
    except ApiError as e:
        if not blockiert(e):
            hart_raus(e, ':validate')
        ohne_pruefung = True
        print('  Vorpruefung uebersprungen — Google laesst gerade kein')
        print('  automatisches Einreichen zu (laufende Richtlinienpruefung).')

    if not ohne_pruefung:
        try:
            call(tok, 'POST', f'{basis}:commit', fatal=False)
            print('  committet — im Play-Eintrag jetzt sichtbar.')
            return
        except ApiError as e:
            if not blockiert(e):
                hart_raus(e, ':commit')

    call(tok, 'POST', f'{basis}:commit?changesNotSentForReview=true')
    print('  committet — ABER NICHT zur Pruefung eingereicht.')
    print('  Die Aenderung liegt jetzt als Entwurf in der Play Console und muss')
    print('  dort von Hand zur Pruefung geschickt werden.')


def lade_einzelbild(tok, datei, lang, image_type, dry_run=False):
    """App-Symbol oder Vorstellungsgrafik ersetzen.

    Die beiden stecken NICHT in der App — sie sind eigene Uploads im
    Store-Eintrag und wandern beim App-Update nicht mit. Genau deshalb standen
    sie nach der Umbenennung noch auf MyPeak, obwohl die App laengst FullRep
    hiess. Beim naechsten Logo- oder Namenswechsel also mit erneuern.
    """
    if not os.path.exists(datei):
        sys.exit(f'Bild nicht gefunden: {datei}')
    print(f'{image_type} fuer {lang}: {os.path.basename(datei)} '
          f'({os.path.getsize(datei) // 1024} KB)')

    if dry_run:
        print('\n--dry-run: nichts hochgeladen, nichts geaendert.')
        return

    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    print(f'\nEdit {eid} geoeffnet')
    base = f'applications/{PKG}/edits/{eid}/listings/{lang}/{image_type}'

    # Play erlaubt hier genau ein Bild — das alte muss weg, sonst kommt 409.
    call(tok, 'DELETE', f'{API}/{base}')
    with open(datei, 'rb') as fh:
        call(tok, 'POST', f'{UPLOAD}/{base}?uploadType=media',
             data=fh.read(), ctype='image/png')
    print(f'  hochgeladen: {os.path.basename(datei)}')

    commit_edit(tok, eid)


def lade_screenshots(tok, verzeichnis, lang, dry_run=False, image_type='phoneScreenshots'):
    """Store-Eintrag-Screenshots ersetzen — alte loeschen, neue in Dateinamen-
    Reihenfolge hochladen. Play zeigt sie in genau dieser Reihenfolge an.

    Achtung: Das Listing ist oeffentlich. Ohne --dry-run ist die Aenderung nach
    dem Commit sofort sichtbar.
    """
    bilder = sorted(glob.glob(os.path.join(verzeichnis, '[0-9][0-9]-*.png')))
    if not bilder:
        sys.exit(f'Keine Screenshots in {verzeichnis} (erwartet: 01-….png)')

    print(f'{len(bilder)} Screenshots fuer {lang} / {image_type}:')
    for b in bilder:
        print(f'  {os.path.basename(b):26} {os.path.getsize(b) // 1024:>5} KB')

    if dry_run:
        print('\n--dry-run: nichts hochgeladen, nichts geaendert.')
        return

    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    print(f'\nEdit {eid} geoeffnet')
    base = f'applications/{PKG}/edits/{eid}/listings/{lang}/{image_type}'

    call(tok, 'DELETE', f'{API}/{base}')
    print('  alte Bilder entfernt')

    for b in bilder:
        with open(b, 'rb') as fh:
            call(tok, 'POST', f'{UPLOAD}/{base}?uploadType=media',
                 data=fh.read(), ctype='image/png')
        print(f'  hochgeladen: {os.path.basename(b)}')

    commit_edit(tok, eid)


# Play weist Ueberlaenge erst beim Commit ab, mit einer wenig sprechenden
# Meldung. Deshalb vorher selbst pruefen.
LISTING_LIMITS = {'title': 30, 'shortDescription': 80, 'fullDescription': 4000}


def setze_listing(tok, datei, lang, dry_run=False):
    """Titel, Kurz- und Volltext des Store-Eintrags setzen.

    Der Titel ist der Name, unter dem die App im Play Store steht — die
    Paket-ID (at.gallab.mypeak) bleibt davon unberuehrt, die ist nach der
    Veroeffentlichung unveraenderlich.

    Gesendet wird per PATCH, also nur die Felder aus der Datei. Was der
    Eintrag sonst noch hat (z. B. ein Promo-Video), bleibt stehen.
    """
    with open(datei, encoding='utf-8') as fh:
        neu = json.load(fh)

    unbekannt = set(neu) - set(LISTING_LIMITS)
    if unbekannt:
        sys.exit(f'Unbekannte Felder in {datei}: {", ".join(sorted(unbekannt))}')
    for feld, grenze in LISTING_LIMITS.items():
        if feld in neu and len(neu[feld]) > grenze:
            sys.exit(f'{feld} ist {len(neu[feld])} Zeichen lang, erlaubt sind {grenze}.')

    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    url = f'{API}/applications/{PKG}/edits/{eid}/listings/{lang}'
    alt = call(tok, 'GET', url)

    print(f'Store-Eintrag {lang}:')
    for feld in ('title', 'shortDescription', 'fullDescription'):
        if feld not in neu:
            continue
        vorher, nachher = alt.get(feld, ''), neu[feld]
        if vorher == nachher:
            print(f'  {feld}: unveraendert')
            continue
        print(f'  {feld}: {len(vorher)} -> {len(nachher)} Zeichen')
        # Ab der ersten abweichenden Stelle zeigen, nicht ab Zeichen 0: bei einem
        # angehaengten Absatz waeren sonst beide Ausschnitte identisch und der
        # Trockenlauf wertlos.
        i = 0
        while i < min(len(vorher), len(nachher)) and vorher[i] == nachher[i]:
            i += 1
        if i:
            print(f'    ... die ersten {i} Zeichen sind gleich, ab da:')
        for name, wert in (('vorher ', vorher), ('nachher', nachher)):
            rest = wert[i:i + 200].replace('\n', '⏎')
            print(f'    {name}: {rest or "(nichts)"}{"…" if len(wert) > i + 200 else ""}')

    if dry_run:
        call(tok, 'DELETE', f'{API}/applications/{PKG}/edits/{eid}')
        print('\n--dry-run: Edit verworfen, am Eintrag hat sich nichts geaendert.')
        return

    call(tok, 'PATCH', url, data=dict(neu, language=lang))
    print()
    commit_edit(tok, eid)


def zeige_status(tok, track='production'):
    eid = call(tok, 'POST', f'{API}/applications/{PKG}/edits')['id']
    tr = call(tok, 'GET', f'{API}/applications/{PKG}/edits/{eid}/tracks/{track}')
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
    p.add_argument('--status', action='store_true', help='nur den Track anzeigen')
    p.add_argument('--screenshots', metavar='VERZEICHNIS',
                   help='Store-Eintrag-Screenshots ersetzen (z. B. store-assets/android)')
    p.add_argument('--listing', metavar='JSON',
                   help='Titel/Beschreibung setzen (z. B. store-assets/play-listing.de-DE.json)')
    p.add_argument('--icon', metavar='PNG',
                   help='App-Symbol im Store-Eintrag ersetzen (512x512)')
    p.add_argument('--feature', metavar='PNG',
                   help='Vorstellungsgrafik ersetzen (1024x500)')
    p.add_argument('--lang', default='de-DE', help='Sprache des Eintrags (Standard: de-DE)')
    p.add_argument('--dry-run', action='store_true',
                   help='nur auflisten, nichts hochladen — das Listing ist oeffentlich')
    p.add_argument('--track', default='production',
                   choices=['production', 'beta', 'alpha', 'internal'],
                   help='Play-Track (Standard: production)')
    a = p.parse_args()

    if not (a.aab or a.promote or a.status or a.screenshots or a.listing
            or a.icon or a.feature):
        p.error('--aab, --promote, --status, --screenshots, --listing, '
                '--icon oder --feature angeben')
    if a.aab and not a.complete and a.fraction is None:
        p.error('--fraction 0.2 oder --complete angeben')

    tok = token()
    if a.status:
        return zeige_status(tok, a.track)
    if a.screenshots:
        return lade_screenshots(tok, a.screenshots, a.lang, a.dry_run)
    if a.listing:
        return setze_listing(tok, a.listing, a.lang, a.dry_run)
    if a.icon:
        return lade_einzelbild(tok, a.icon, a.lang, 'icon', a.dry_run)
    if a.feature:
        return lade_einzelbild(tok, a.feature, a.lang, 'featureGraphic', a.dry_run)

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

    release = {'name': f'{vc}', 'versionCodes': [str(vc)]}
    if a.complete:
        release['status'] = 'completed'
    else:
        release['status'] = 'inProgress'
        release['userFraction'] = a.fraction
    if a.notes:
        release['releaseNotes'] = [{'language': 'de-DE', 'text': a.notes}]

    call(tok, 'PUT', f'{API}/applications/{PKG}/edits/{eid}/tracks/{a.track}',
         data={'track': a.track, 'releases': [release]})
    ziel = 'alle Nutzer' if a.complete else f'{a.fraction * 100:.0f} % der Nutzer'
    print(f'Track {a.track} gesetzt: versionCode {vc} an {ziel}')

    # Ueber den Helfer: steht die App unter Richtlinienpruefung, wuerde ein
    # direkter Abschluss die ganze Hochlade-Arbeit verwerfen.
    commit_edit(tok, eid)


if __name__ == '__main__':
    main()
