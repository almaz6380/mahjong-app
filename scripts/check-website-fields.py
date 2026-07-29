#!/usr/bin/env python3
"""Prüft die Entwickler-Website in beiden Store-Einträgen — NUR LESEND.

Hintergrund: Googles app-ads.txt-Crawler findet unsere Datei ausschließlich
über die Website, die im Store-Eintrag hinterlegt ist. Er hängt an diese URL
`/app-ads.txt` an. Steht dort eine andere oder gar keine Domain, bleibt
`public/app-ads.txt` wirkungslos und Werbetreibende, die nur bei
autorisierten Verkäufern einkaufen, kaufen unser Inventar nicht.

Das Skript prüft deshalb beides:
  1. steht in beiden Konsolen die erwartete Domain?
  2. liefert diese Domain /app-ads.txt wirklich mit unserer Publisher-ID aus?

Play:  edits.insert -> edits.details.get -> edits.delete
       (reine Lese-Transaktion; es wird nie committet, der Store-Eintrag
        bleibt unverändert)
ASC:   appStoreVersions -> appStoreVersionLocalizations
       (marketingUrl = „Developer Website“ auf der Produktseite, supportUrl
        = „App Support“)

Voraussetzung: pyjwt + cryptography sowie die beiden API-Schlüssel
  ~/.config/play-publisher/key.json
  ~/.appstoreconnect/private_keys/AuthKey_VGHCB8Z8Q2.p8

Aufruf:  python3 scripts/check-website-fields.py
Exit-Code 0 = alles passt, 1 = mindestens ein Feld stimmt nicht (für Release-Checks).
"""
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
WEBSITE = 'https://mahjong-app-plum.vercel.app'
HOST = 'mahjong-app-plum.vercel.app'
PUBLISHER = 'pub-8860791993288062'

probleme = []


def load(name, datei):
    """Nachbar-Skript als Modul laden, um dessen Auth wiederzuverwenden."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(SCRIPTS, datei))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def bewerte(feld, url):
    if not url:
        probleme.append(f'{feld}: leer')
        return 'LEER — der Crawler findet nichts'
    if HOST not in url:
        probleme.append(f'{feld}: {url}')
        return f'ANDERE DOMAIN (erwartet {HOST})'
    return 'passt'


def head(titel):
    print('\n' + '=' * 70 + f'\n{titel}\n' + '=' * 70)


# ---------------------------------------------------------------- Google Play
def play():
    head('GOOGLE PLAY  (com.mahjongroyale.app)')
    pu = load('play_upload', 'play-upload.py')
    tok = pu.token()
    base = f'{pu.API}/applications/{pu.PKG}/edits'

    eid = pu.call(tok, 'POST', base, data={})['id']
    try:
        d = pu.call(tok, 'GET', f'{base}/{eid}/details')
        web = d.get('contactWebsite')
        print(f"  Website (contactWebsite): {web or '(leer)'}")
        print(f"    -> {bewerte('Play/contactWebsite', web)}")
        print(f"  E-Mail                  : {d.get('contactEmail') or '(leer)'}")
        print(f"  Standardsprache         : {d.get('defaultLanguage')}")
    finally:
        try:
            pu.call(tok, 'DELETE', f'{base}/{eid}')
            print('  (Lese-Edit verworfen — am Store-Eintrag wurde nichts geändert)')
        except Exception as e:
            print(f'  Hinweis: Edit {eid} nicht verworfen ({e}); er läuft von selbst ab.')


# ------------------------------------------------------------ App Store Connect
def asc():
    head('APP STORE CONNECT  (App-ID 6787721454)')
    a = load('asc_status', 'asc-status.py')
    tok = a.token()

    for v in a.get(tok, f'/v1/apps/{a.APP_ID}/appStoreVersions?limit=3')['data']:
        at = v['attributes']
        zustand = at['appStoreState']
        print(f"\n  Version {at['versionString']} — {zustand}")
        if zustand not in ('READY_FOR_SALE', 'PENDING_DEVELOPER_RELEASE'):
            print('    (noch nicht veröffentlicht — bis zur Freigabe gibt es keine')
            print('     Store-Seite, die der Crawler lesen könnte)')
        locs = a.get(
            tok, f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations?limit=20")
        for l in locs['data']:
            la = l['attributes']
            loc = la['locale']
            print(f"    [{loc}]")
            for feld, schluessel in (("marketingUrl (= 'Developer Website')", 'marketingUrl'),
                                     ('supportUrl                         ', 'supportUrl')):
                url = la.get(schluessel)
                print(f"      {feld}: {url or '(leer)'}")
                print(f"        -> {bewerte(f'ASC/{loc}/{schluessel}', url)}")


# ------------------------------------------------------ die Datei selbst prüfen
def datei():
    head(f'AUSLIEFERUNG  {WEBSITE}/app-ads.txt')
    try:
        with urllib.request.urlopen(f'{WEBSITE}/app-ads.txt', timeout=20) as r:
            ctype = r.headers.get('Content-Type', '')
            text = r.read().decode(errors='replace')
    except Exception as e:
        probleme.append(f'app-ads.txt nicht abrufbar: {e}')
        print(f'  NICHT ERREICHBAR: {e}')
        return
    print(f'  HTTP 200, Content-Type: {ctype}')
    print(f'  Inhalt: {text.strip()!r}')
    if not ctype.startswith('text/plain'):
        probleme.append(f'app-ads.txt wird als {ctype} ausgeliefert, nicht als text/plain')
        print('  -> FALSCHER TYP (der Crawler erwartet reinen Text)')
    if PUBLISHER not in text:
        probleme.append(f'Publisher-ID {PUBLISHER} fehlt in app-ads.txt')
        print(f'  -> PUBLISHER-ID {PUBLISHER} FEHLT')
    else:
        print('  -> Publisher-ID vorhanden, Typ korrekt')


if __name__ == '__main__':
    nicht_geprueft = []
    for fn in (play, asc, datei):
        try:
            fn()
        except SystemExit as e:
            nicht_geprueft.append(f'{fn.__name__}: {e}')
        except Exception as e:
            nicht_geprueft.append(f'{fn.__name__}: {type(e).__name__}: {e}')

    head('ERGEBNIS')
    if nicht_geprueft:
        print('  NICHT GEPRÜFT (Fehler beim Zugriff):')
        for n in nicht_geprueft:
            print(f'    - {n}')
    if probleme:
        print('  PROBLEME:')
        for p in probleme:
            print(f'    - {p}')
    elif not nicht_geprueft:
        print('  Alles in Ordnung: Website-Felder passen, app-ads.txt wird korrekt')
        print('  ausgeliefert. AdMob zeigt den Status meist nach ~24 h als autorisiert.')
    sys.exit(1 if (probleme or nicht_geprueft) else 0)
