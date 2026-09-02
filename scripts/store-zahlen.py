#!/usr/bin/env python3
"""Store-Zahlen abrufen — Installationen, Akquise-Trichter, Downloads.

REIN LESEND. Dieses Skript aendert nichts in den Stores; es holt nur Berichte.

Warum es das ueberhaupt gibt: Die APIs, mit denen wir veroeffentlichen
(androidpublisher, App Store Connect), kennen KEINE Statistiken. Die Zahlen
liegen woanders:

  Android  Play Console exportiert CSV-Berichte in einen Google-Cloud-Storage-
           Eimer des Entwicklerkontos (Name faengt mit `pubsite_prod_` an).
           Dort liegen `stats/installs/...` (Installationen) und
           `stats/store_performance/...` (Impressionen -> Eintragsbesucher ->
           Akquise). Die Play Developer Reporting API hilft NICHT: die kennt
           nur Abstuerze, ANRs und Startzeiten.
  iOS      App Store Connect: `salesReports` liefert taeglich Downloads
           (sofort verfuegbar). Impressionen, Produktseitenaufrufe und
           Bindungsrate stecken in den Analytics-Reports — die muessen einmal
           angefordert werden und Apple braucht danach bis zu zwei Tage, bis
           Daten bereitstehen (--ios-analytics).

Zugang ueber dieselben Umgebungsvariablen wie die uebrigen Skripte; in der CI
kommen sie aus den Repo-Secrets:

  PLAY_KEY               Pfad zum Dienstkonto-JSON (Standard:
                         ~/.config/play-publisher/key.json)
  PLAY_REPORTS_BUCKET    Name des Berichts-Eimers, OHNE `gs://`.
                         Play Console -> Downloadberichte -> Statistiken ->
                         „Cloud Storage-URI kopieren"; der Teil zwischen
                         gs:// und dem ersten / ist der Name.
  ASC_KEY_ID             z. B. VGHCB8Z8Q2
  ASC_ISSUER_ID          UUID des Teams
  ASC_KEY_P8             Inhalt der .p8-Datei (nicht base64)

Beispiele:
    python3 scripts/store-zahlen.py                    # alles, 30 Tage
    python3 scripts/store-zahlen.py --tage 90 --play   # nur Android
    python3 scripts/store-zahlen.py --ios-analytics    # Apple-Trichter anstossen
"""
import argparse
import csv
import gzip
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

PKG = os.environ.get('PLAY_PACKAGE') or 'com.mahjongroyale.app'
ASC_APP_ID = os.environ.get('ASC_APP_ID') or '6787721454'
ASC_VENDOR = os.environ.get('ASC_VENDOR_NUMBER') or ''
PLAY_KEY = os.environ.get('PLAY_KEY') or os.path.expanduser('~/.config/play-publisher/key.json')
BUCKET = (os.environ.get('PLAY_REPORTS_BUCKET') or '').replace('gs://', '').strip('/')

ASC_API = 'https://api.appstoreconnect.apple.com/v1'
GCS = 'https://storage.googleapis.com/storage/v1'


# ── Hilfen ─────────────────────────────────────────────────────────────────

def _jwt():
    try:
        import jwt  # pyjwt
    except ImportError:
        sys.exit('Fehlt: pip3 install pyjwt cryptography')
    return jwt


def hol(url, headers=None, fatal=False):
    """GET; gibt (status, bytes) zurueck. Wirft nur bei --fatal ab."""
    req = urllib.request.Request(url)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        leib = e.read()[:400].decode('utf-8', 'replace')
        if fatal:
            sys.exit(f'HTTP {e.code} bei {url}\n{leib}')
        return e.code, leib.encode()
    except urllib.error.URLError as e:
        if fatal:
            sys.exit(f'Netzfehler bei {url}: {e}')
        return 0, str(e).encode()


def tabelle(zeilen, kopf):
    """Feste Spaltenbreiten — im Actions-Protokoll ist Markdown nutzlos."""
    if not zeilen:
        print('   (keine Daten)')
        return
    spalten = list(zip(*([kopf] + [[str(z) for z in r] for r in zeilen])))
    breit = [max(len(x) for x in s) for s in spalten]
    def zeile(werte):
        return '   ' + '  '.join(str(w).ljust(b) for w, b in zip(werte, breit))
    print(zeile(kopf))
    print('   ' + '  '.join('-' * b for b in breit))
    for r in zeilen:
        print(zeile(r))


def monate(tage):
    """Die YYYYMM-Marken, die einen Zeitraum von `tage` Tagen abdecken."""
    heute = date.today()
    start = heute - timedelta(days=tage)
    out, m = [], date(start.year, start.month, 1)
    while m <= heute:
        out.append(m.strftime('%Y%m'))
        m = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    return out


# ── Android ────────────────────────────────────────────────────────────────

def play_token(scope):
    jwt = _jwt()
    if not os.path.exists(PLAY_KEY):
        sys.exit(f'Dienstkonto-Key nicht gefunden: {PLAY_KEY}')
    with open(PLAY_KEY) as fh:
        k = json.load(fh)
    now = int(time.time())
    assertion = jwt.encode(
        {'iss': k['client_email'], 'scope': scope,
         'aud': 'https://oauth2.googleapis.com/token', 'iat': now, 'exp': now + 3600},
        k['private_key'], algorithm='RS256')
    body = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': assertion}).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=body)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['access_token']


def csv_lesen(rohdaten):
    """Play-Berichte sind UTF-16 mit BOM — sonst kommt Zeichensalat heraus."""
    for kodierung in ('utf-16', 'utf-8-sig', 'utf-8'):
        try:
            text = rohdaten.decode(kodierung)
        except (UnicodeDecodeError, UnicodeError):
            continue
        if '\x00' in text:
            continue
        return list(csv.DictReader(io.StringIO(text)))
    return []


def gcs_objekte(tok, prefix):
    url = f'{GCS}/b/{urllib.parse.quote(BUCKET)}/o?prefix={urllib.parse.quote(prefix)}'
    code, leib = hol(url, {'Authorization': f'Bearer {tok}'})
    if code == 403:
        print(f'   Kein Leserecht auf gs://{BUCKET}. Das Dienstkonto braucht in der')
        print('   Play Console unter Nutzer und Berechtigungen zusaetzlich')
        print('   „Finanzdaten, Bestellungen und Umfragen ansehen" bzw. Leserecht')
        print('   auf den Berichts-Eimer. Einmal setzen, dann laeuft es.')
        return []
    if code != 200:
        print(f'   Eimer nicht lesbar (HTTP {code}): {leib[:200].decode("utf-8", "replace")}')
        return []
    return [o['name'] for o in json.loads(leib).get('items', [])]


def gcs_holen(tok, name):
    url = (f'{GCS}/b/{urllib.parse.quote(BUCKET)}/o/'
           f'{urllib.parse.quote(name, safe="")}?alt=media')
    code, leib = hol(url, {'Authorization': f'Bearer {tok}'})
    return csv_lesen(leib) if code == 200 else []


def zahl(wert):
    try:
        return int(float(str(wert).replace(',', '.') or 0))
    except ValueError:
        return 0


def android(tage):
    print('\n=== ANDROID (Google Play) ===')
    if not BUCKET:
        print('  PLAY_REPORTS_BUCKET ist nicht gesetzt — ohne Eimernamen gibt es')
        print('  keine Play-Statistik. Zu finden in der Play Console unter')
        print('  Downloadberichte -> Statistiken -> „Cloud Storage-URI kopieren";')
        print('  gebraucht wird nur der Teil zwischen gs:// und dem ersten /.')
        print('  Danach als Repo-Variable PLAY_REPORTS_BUCKET hinterlegen.')
        return
    tok = play_token('https://www.googleapis.com/auth/devstorage.read_only')
    grenze = (date.today() - timedelta(days=tage)).strftime('%Y-%m-%d')
    mm = monate(tage)

    # --- Installationen pro Tag -------------------------------------------
    print(f'\n-- Installationen (ab {grenze}) --')
    zeilen = []
    for m in mm:
        for name in gcs_objekte(tok, f'stats/installs/installs_{PKG}_{m}_overview'):
            zeilen += gcs_holen(tok, name)
    tage_daten = []
    for r in zeilen:
        tag = (r.get('Date') or r.get('Datum') or '').strip()
        if tag and tag >= grenze:
            tage_daten.append((
                tag,
                zahl(r.get('Daily Device Installs') or r.get('Daily User Installs')),
                zahl(r.get('Daily Device Uninstalls') or r.get('Daily User Uninstalls')),
                zahl(r.get('Active Device Installs') or r.get('Total User Installs')),
            ))
    tage_daten.sort()
    if tage_daten:
        summe = sum(t[1] for t in tage_daten)
        print(f'   Summe im Zeitraum: {summe} Installationen an {len(tage_daten)} Tagen'
              f'  (Ø {summe / max(1, len(tage_daten)):.1f}/Tag)')
        tabelle(tage_daten[-14:], ['Tag', 'Neu', 'Deinst.', 'Aktiv'])
        if len(tage_daten) > 14:
            print(f'   (nur die letzten 14 von {len(tage_daten)} Tagen gezeigt)')
    else:
        print('   Keine Installationsberichte gefunden. Berichte erscheinen mit ein')
        print('   bis zwei Tagen Verzug und immer erst fuer den ganzen Monat.')

    # --- Akquise-Trichter --------------------------------------------------
    print('\n-- Akquise-Trichter (Store-Eintrag) --')
    roh = []
    for m in mm:
        for muster in (f'stats/store_performance/store_performance_{PKG}_{m}_country',
                       f'stats/store_performance/store_performance_{PKG}_{m}_traffic_source'):
            for name in gcs_objekte(tok, muster):
                roh += [(name, r) for r in gcs_holen(tok, name)]
    trichter = defaultdict(lambda: [0, 0, 0])
    for name, r in roh:
        tag = (r.get('Date') or '').strip()
        if not tag or tag < grenze:
            continue
        art = 'Laender' if '_country' in name else 'Quellen'
        eintrag = trichter[art]
        eintrag[0] += zahl(r.get('Store Listing Acquisitions'))
        eintrag[1] += zahl(r.get('Store Listing Visitors'))
        eintrag[2] += zahl(r.get('Store Listing Impressions') or r.get('Impressions'))
    if trichter:
        for art, (akq, bes, imp) in trichter.items():
            quote_b = f'{100 * bes / imp:.1f} %' if imp else '—'
            quote_a = f'{100 * akq / bes:.1f} %' if bes else '—'
            print(f'   [{art}] Impressionen {imp} -> Besucher {bes} ({quote_b}) '
                  f'-> Installationen {akq} ({quote_a})')
        print('   Die zweite Quote ist die entscheidende: unter etwa 10 % liegt das')
        print('   Problem am Eintrag (Icon, erste Screenshots), nicht an der Reichweite.')
    else:
        print('   Keine Store-Performance-Berichte im Zeitraum gefunden.')

    print('\n   Bindungsrate (Tag 1 / Tag 7) steht NICHT im Export — die gibt es nur')
    print('   in der Play Console unter Statistiken -> Nutzer -> Bindung.')


# ── iOS ────────────────────────────────────────────────────────────────────

def asc_fehlt():
    """Namen der fehlenden Zugangsvariablen — leer heisst startklar."""
    return [n for n in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8')
            if not os.environ.get(n)]


def asc_token():
    jwt = _jwt()
    kid, iss, p8 = (os.environ.get('ASC_KEY_ID'), os.environ.get('ASC_ISSUER_ID'),
                    os.environ.get('ASC_KEY_P8'))
    now = int(time.time())
    return jwt.encode({'iss': iss, 'iat': now, 'exp': now + 15 * 60,
                       'aud': 'appstoreconnect-v1'},
                      p8, algorithm='ES256', headers={'kid': kid, 'typ': 'JWT'})


def asc(tok, pfad, method='GET', body=None):
    url = pfad if pfad.startswith('http') else f'{ASC_API}/{pfad.lstrip("/")}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {tok}')
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except ValueError:
            return e.code, {}


def asc_probe(tok):
    """Trennt die zwei Faelle, die beide als 403 daherkommen: Schluessel kaputt
    oder Schluessel gueltig, aber ohne die noetige Rolle."""
    code, d = asc(tok, f'apps/{ASC_APP_ID}')
    if code == 200:
        name = d.get('data', {}).get('attributes', {}).get('name', '?')
        print(f'   Schluessel gueltig (App „{name}" lesbar).')
        return True
    fehler = '; '.join(str(e.get('detail') or e.get('title'))
                       for e in d.get('errors', []))[:300]
    print(f'   Schluessel kommt nicht einmal an die App-Daten (HTTP {code}). {fehler}')
    return False


def rollen_hinweis():
    print('   Wahrscheinliche Ursache: Der API-Schluessel wurde zum Hochladen von')
    print('   Builds angelegt und hat die Rolle „App Manager" o. ae. Verkaufs- und')
    print('   Analytics-Berichte verlangen ADMIN, FINANCE oder SALES.')
    print('   Abhilfe: App Store Connect -> Nutzer und Zugriff -> Integrationen ->')
    print('   App Store Connect API -> neuen Schluessel mit Rolle „Finance" oder')
    print('   „Admin" erzeugen und ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_P8_BASE64')
    print('   in den Repo-Secrets darauf umstellen. Der alte Schluessel kann fuers')
    print('   Hochladen bleiben — dann braucht es ein zweites Paar Secrets.')


def vendor_nummer(tok):
    """Die Verkaeufernummer haengt am Konto, nicht an der App."""
    if ASC_VENDOR:
        return ASC_VENDOR
    code, d = asc(tok, 'salesReports?filter[frequency]=DAILY')
    fehler = '; '.join(str(e.get('detail') or e.get('title'))
                       for e in d.get('errors', []))[:400]
    print(f'   Probeabfrage salesReports -> HTTP {code}'
          + (f': {fehler}' if fehler else ''))
    if code in (401, 403):
        rollen_hinweis()
        return ''
    # Apple nennt die gueltigen Werte in der Fehlermeldung mit, etwa
    # "The following values are valid: 12345678". Nur daraus lesen — irgendeine
    # Ziffernfolge aus dem Text zu greifen waere geraten.
    import re as _re
    for e in d.get('errors', []):
        text = str(e.get('detail', ''))
        if 'valid' not in text.lower():
            continue
        treffer = _re.findall(r'\b(\d{7,12})\b', text.split('valid', 1)[-1])
        if treffer:
            print(f'   Verkaeufernummer aus Apples Antwort gelesen: {treffer[0]}')
            return treffer[0]
    return ''


def ios_downloads(tage):
    print('\n=== iOS (App Store) ===')
    if asc_fehlt():
        print(f'   Uebersprungen, es fehlen: {", ".join(asc_fehlt())}')
        return
    tok = asc_token()
    if not asc_probe(tok):
        return
    vn = vendor_nummer(tok)
    if not vn:
        print('  Verkaeufernummer nicht ermittelbar. Sie steht in App Store Connect')
        print('  oben rechts unter „Zahlungen und Finanzberichte" und gehoert dann')
        print('  als Repo-Variable ASC_VENDOR_NUMBER hinterlegt.')
        return
    print(f'\n-- Downloads pro Tag (Verkaeufer {vn}) --')
    zeilen = []
    for i in range(1, min(tage, 60) + 1):
        tag = (date.today() - timedelta(days=i)).strftime('%Y-%m-%d')
        url = (f'{ASC_API}/salesReports?filter[frequency]=DAILY'
               f'&filter[reportType]=SALES&filter[reportSubType]=SUMMARY'
               f'&filter[vendorNumber]={vn}&filter[reportDate]={tag}')
        code, leib = hol(url, {'Authorization': f'Bearer {tok}',
                               'Accept': 'application/a-gzip'})
        if code != 200:
            continue
        try:
            text = gzip.decompress(leib).decode('utf-8', 'replace')
        except (OSError, EOFError):
            continue
        einheiten = 0
        for r in csv.DictReader(io.StringIO(text), delimiter='\t'):
            # Produkttypen, die mit 1 beginnen, sind App-Installationen
            # (1 = iPhone, 1F = universal, 1T = iPad). Aktualisierungen (7)
            # und In-App-Kaeufe (IA*) bleiben damit aussen vor.
            if str(r.get('Product Type Identifier', '')).startswith('1'):
                einheiten += zahl(r.get('Units'))
        zeilen.append((tag, einheiten))
    zeilen.sort()
    if zeilen:
        summe = sum(z[1] for z in zeilen)
        print(f'   Summe: {summe} Downloads an {len(zeilen)} Tagen'
              f'  (Ø {summe / max(1, len(zeilen)):.1f}/Tag)')
        tabelle(zeilen[-14:], ['Tag', 'Downloads'])
    else:
        print('   Keine Verkaufsberichte abrufbar. Tagesberichte gibt es erst ab dem')
        print('   Folgetag, und an Tagen ganz ohne Downloads liefert Apple 404.')


def ios_analytics(nur_status=False):
    """Impressionen, Seitenaufrufe und Bindung — Apple braucht dafuer Vorlauf."""
    print('\n=== iOS Analytics-Berichte ===')
    if asc_fehlt():
        print(f'   Uebersprungen, es fehlen: {", ".join(asc_fehlt())}')
        return
    tok = asc_token()
    code, d = asc(tok, f'apps/{ASC_APP_ID}/analyticsReportRequests?limit=50')
    if code != 200:
        fehler = '; '.join(str(e.get('detail') or e.get('title'))
                           for e in d.get('errors', []))[:400]
        print(f'   Abfrage fehlgeschlagen (HTTP {code})'
              + (f': {fehler}' if fehler else '.'))
        if code in (401, 403):
            rollen_hinweis()
        return
    vorhanden = d.get('data', [])
    laufend = [r for r in vorhanden
               if r.get('attributes', {}).get('accessType') == 'ONGOING']
    if not laufend:
        if nur_status:
            print('   Noch keine laufende Berichtsanforderung vorhanden.')
            print('   Mit --ios-analytics einmalig anfordern.')
            return
        code, neu = asc(tok, 'analyticsReportRequests', 'POST', {
            'data': {'type': 'analyticsReportRequests',
                     'attributes': {'accessType': 'ONGOING'},
                     'relationships': {'app': {'data': {'type': 'apps',
                                                        'id': ASC_APP_ID}}}}})
        if code in (200, 201):
            print('   Berichte angefordert. Apple bereitet die Daten jetzt auf —')
            print('   das dauert ueblicherweise ein bis zwei Tage. Danach liefert')
            print('   dieser Aufruf Impressionen, Produktseitenaufrufe und Bindung.')
        else:
            print(f'   Anforderung abgelehnt (HTTP {code}): '
                  f'{json.dumps(neu)[:300]}')
        return

    rid = laufend[0]['id']
    code, rep = asc(tok, f'analyticsReportRequests/{rid}/reports?limit=200')
    berichte = rep.get('data', []) if code == 200 else []
    if not berichte:
        print('   Anforderung liegt vor, aber Apple hat noch keine Berichte erzeugt.')
        print('   Nach der ersten Anforderung dauert das ein bis zwei Tage.')
        return
    print(f'   {len(berichte)} Berichte verfuegbar. Namen (Auszug):')
    for b in berichte[:25]:
        a = b.get('attributes', {})
        print(f"     - {a.get('name')}  [{a.get('category')}]")
    print('   Die Auswertung der einzelnen Berichte (Instanzen -> Segmente ->')
    print('   CSV) baue ich, sobald hier echte Namen stehen — vorher waere es')
    print('   geraten, welche Spalten Apple liefert.')


# ── Einstieg ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--tage', type=int, default=30, help='Zeitraum (Standard 30)')
    p.add_argument('--play', action='store_true', help='nur Android')
    p.add_argument('--ios', action='store_true', help='nur iOS-Downloads')
    p.add_argument('--ios-analytics', action='store_true',
                   help='Apple-Analytics anfordern bzw. Stand anzeigen')
    a = p.parse_args()
    alles = not (a.play or a.ios or a.ios_analytics)

    print(f'Store-Zahlen fuer {PKG} — Zeitraum {a.tage} Tage, '
          f'Stand {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC')
    print('Rein lesend; es wird nichts veroeffentlicht oder geaendert.')

    if a.play or alles:
        try:
            android(a.tage)
        except SystemExit:
            raise
        except Exception as e:                       # noqa: BLE001
            print(f'\n   Android-Teil abgebrochen: {e!r}')
    if a.ios or alles:
        try:
            ios_downloads(a.tage)
        except SystemExit:
            raise
        except Exception as e:                       # noqa: BLE001
            print(f'\n   iOS-Teil abgebrochen: {e!r}')
    if a.ios_analytics or alles:
        try:
            ios_analytics(nur_status=alles)
        except SystemExit:
            raise
        except Exception as e:                       # noqa: BLE001
            print(f'\n   Analytics-Teil abgebrochen: {e!r}')

    print('\nFertig. Bindungsrate (Tag 1/7) bleibt auf Android Handarbeit:')
    print('Play Console -> Statistiken -> Nutzer -> Bindung.')


if __name__ == '__main__':
    main()
