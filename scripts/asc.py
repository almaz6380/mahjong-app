#!/usr/bin/env python3
"""App Store Connect über die API steuern.

Nur Standardbibliothek + pyjwt/cryptography. Zugang über drei Umgebungs-
variablen, die in der CI aus den Repo-Secrets kommen:

  ASC_KEY_ID      z. B. VGHCB8Z8Q2
  ASC_ISSUER_ID   UUID des Teams
  ASC_KEY_P8      Inhalt der .p8-Datei (nicht base64)

Apple signiert die Tokens mit ES256 und laesst hoechstens 20 Minuten Laufzeit
zu — deshalb kurz halten, nicht zwischenspeichern.

    python3 scripts/asc.py --status
    python3 scripts/asc.py --name          # Anzeigename + Untertitel setzen
    python3 scripts/asc.py --build 4       # Build der offenen Version zuweisen
    python3 scripts/asc.py --screenshots   # iPhone- + iPad-Bilder ersetzen
    python3 scripts/asc.py --abo-screenshot
    python3 scripts/asc.py --einreichen

Schreibende Befehle nehmen --dry-run: dann steht im Protokoll, was passieren
wuerde, es geht aber nichts zu Apple.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.appstoreconnect.apple.com/v1'
BUNDLE = os.environ.get('ASC_BUNDLE_ID') or 'com.mahjongroyale.app'
WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Store-Namen aus CLAUDE.md, je <= 30 Zeichen (Apples Grenze fuer name,
# 30 fuer subtitle).
NAMEN = {}

# Welcher Ordner in welchen Screenshot-Typ gehoert. 1320x2868 ist das
# iPhone-6,9"-Format, 2048x2732 das iPad-12,9".
BILDER = [
    ('store/ios-screenshots', 'APP_IPHONE_67'),
]

# ── In dieser Kopie nicht konfiguriert ─────────────────────────────────────
# Diese Befehle tragen in MyPeaks Fassung fest verdrahtete Texte (Store-Namen,
# Prueferhinweise, Abo-Bezeichnungen). Sie hier blind auszufuehren wuerde die
# Texte EINER ANDEREN App in diese schreiben. Wer sie braucht, traegt zuerst
# die eigenen Werte im Skript ein und entfernt den Namen aus dieser Liste.
NICHT_KONFIGURIERT = ['name', 'pruefnotiz', 'abo_screenshot', 'abo_namen', 'abo_notiz']


def _sperre_pruefen(a):
    for feld in NICHT_KONFIGURIERT:
        if getattr(a, feld, False):
            sys.exit(
                f"--{feld.replace('_', '-')} ist in diesem Repo nicht konfiguriert.\n"
                "Die Vorlage stammt aus MyPeak und enthaelt dessen Texte.\n"
                "Erst eigene Werte im Skript eintragen, dann NICHT_KONFIGURIERT kuerzen."
            )

TROCKEN = False
TROTZDEM = False


def token() -> str:
    try:
        import jwt  # pyjwt
    except ImportError:
        sys.exit('Fehlt: pip3 install pyjwt cryptography')
    key_id = os.environ.get('ASC_KEY_ID')
    issuer = os.environ.get('ASC_ISSUER_ID')
    p8 = os.environ.get('ASC_KEY_P8')
    fehlt = [n for n, v in (('ASC_KEY_ID', key_id), ('ASC_ISSUER_ID', issuer),
                            ('ASC_KEY_P8', p8)) if not v]
    if fehlt:
        sys.exit(f'Fehlende Umgebungsvariablen: {", ".join(fehlt)}')
    now = int(time.time())
    return jwt.encode(
        {'iss': issuer, 'iat': now, 'exp': now + 15 * 60,
         'aud': 'appstoreconnect-v1'},
        p8,
        algorithm='ES256',
        headers={'kid': key_id, 'typ': 'JWT'},
    )


def api(tok, pfad, method='GET', body=None, fatal=True):
    url = pfad if pfad.startswith('http') else f'{API}/{pfad.lstrip("/")}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {tok}')
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            roh = r.read()
            return json.loads(roh) if roh else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors='replace')
        if not fatal:
            return {'_fehler': e.code, '_detail': detail}
        sys.exit(f'\nFEHLER {e.code} bei {method} {url}\n{detail}\n')


def fehler_text(res):
    """Apples Fehlerobjekt auf eine Zeile eindampfen."""
    try:
        d = json.loads(res.get('_detail') or '{}')
        return '; '.join(
            f'{e.get("title")}: {e.get("detail")}' for e in d.get('errors', []))
    except (ValueError, AttributeError):
        return res.get('_detail', '')


def app_id(tok):
    res = api(tok, f'apps?filter[bundleId]={urllib.parse.quote(BUNDLE)}')
    if not res.get('data'):
        sys.exit(f'Keine App mit Bundle-ID {BUNDLE} gefunden.')
    app = res['data'][0]
    print(f'App: {app["attributes"]["name"]}  ({BUNDLE}, id {app["id"]})')
    return app['id']


def offene_version(tok, aid):
    """Die Version, an der noch gearbeitet wird (nicht READY_FOR_SALE)."""
    vers = api(tok, f'apps/{aid}/appStoreVersions?limit=10')
    fertig = {'READY_FOR_SALE', 'REPLACED_BY_NEW_VERSION',
              'REMOVED_FROM_SALE', 'DEVELOPER_REMOVED_FROM_SALE'}
    for v in vers.get('data', []):
        if v['attributes'].get('appStoreState') not in fertig:
            return v
    sys.exit('Keine offene Version gefunden — in ASC eine neue Version anlegen.')


# ── Datei-Upload ───────────────────────────────────────────────────────────
# Apple laeuft dreistufig: reservieren (POST, liefert uploadOperations),
# Stuecke hochladen, dann bestaetigen (PATCH uploaded=true + MD5). Bricht
# man in der Mitte ab, bleibt eine halbe Datei stehen, die spaeter als
# "asset delivery failed" auffaellt — deshalb kein frueher return.

def _hochladen(tok, res, pfad, art):
    daten = open(pfad, 'rb').read()
    for op in res['data']['attributes']['uploadOperations']:
        stueck = daten[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], data=stueck, method=op['method'])
        for h in op.get('requestHeaders', []):
            req.add_header(h['name'], h['value'])
        with urllib.request.urlopen(req) as r:
            r.read()
    md5 = hashlib.md5(daten).hexdigest()
    return api(tok, f'{art}/{res["data"]["id"]}', 'PATCH', {
        'data': {'type': art, 'id': res['data']['id'],
                 'attributes': {'uploaded': True, 'sourceFileChecksum': md5}},
    }, fatal=False)


def datei_hoch(tok, art, pfad, beziehung):
    """art z. B. 'appScreenshots', beziehung = {'name': {'data': {...}}}."""
    name = os.path.basename(pfad)
    groesse = os.path.getsize(pfad)
    if TROCKEN:
        print(f'    [trocken] {name} ({groesse} Bytes) -> {art}')
        return True
    res = api(tok, art, 'POST', {
        'data': {'type': art,
                 'attributes': {'fileSize': groesse, 'fileName': name},
                 'relationships': beziehung},
    }, fatal=False)
    if res.get('_fehler'):
        print(f'    FEHLER beim Reservieren von {name}: {fehler_text(res)}')
        return False
    fertig = _hochladen(tok, res, pfad, art)
    if fertig.get('_fehler'):
        print(f'    FEHLER beim Bestaetigen von {name}: {fehler_text(fertig)}')
        return False
    print(f'    {name} hochgeladen')
    return True


# ── Befehle ────────────────────────────────────────────────────────────────

def setze_namen(tok):
    aid = app_id(tok)
    infos = api(tok, f'apps/{aid}/appInfos')
    # Der Anzeigename haengt am appInfo, nicht an der Version. Bei einer
    # eingereichten App gibt es zwei: das lebende und das bearbeitbare.
    # Nur letzteres nimmt einen PATCH an.
    for info in infos.get('data', []):
        zustand = (info['attributes'].get('appStoreState')
                   or info['attributes'].get('state') or '?')
        locs = api(tok, f'appInfos/{info["id"]}/appInfoLocalizations')
        for loc in locs.get('data', []):
            a = loc['attributes']
            soll = NAMEN.get(a['locale'])
            if not soll:
                continue
            name, untertitel = soll
            if a.get('name') == name and a.get('subtitle') == untertitel:
                print(f'  {a["locale"]}: steht schon richtig')
                continue
            print(f'  {a["locale"]} ({zustand}): {a.get("name")!r} -> {name!r}')
            if TROCKEN:
                continue
            res = api(tok, f'appInfoLocalizations/{loc["id"]}', 'PATCH', {
                'data': {'type': 'appInfoLocalizations', 'id': loc['id'],
                         'attributes': {'name': name, 'subtitle': untertitel}},
            }, fatal=False)
            if res.get('_fehler'):
                print(f'    nicht aenderbar: {fehler_text(res)}')
            else:
                print('    gesetzt')


def setze_build(tok, nummer):
    aid = app_id(tok)
    v = offene_version(tok, aid)
    print(f'  Version {v["attributes"]["versionString"]} '
          f'({v["attributes"].get("appStoreState")})')
    builds = api(tok, f'builds?filter[app]={aid}&limit=20&sort=-version')
    treffer = [b for b in builds.get('data', [])
               if b['attributes'].get('version') == str(nummer)]
    if not treffer:
        sys.exit(f'  Build {nummer} nicht gefunden.')
    b = treffer[0]
    zustand = b['attributes'].get('processingState')
    print(f'  Build {nummer}: {zustand}')
    if zustand != 'VALID':
        sys.exit('  Build ist noch nicht VALID — Apple verarbeitet ihn noch.')
    if TROCKEN:
        print('  [trocken] wuerde zugewiesen')
        return
    res = api(tok, f'appStoreVersions/{v["id"]}/relationships/build', 'PATCH', {
        'data': {'type': 'builds', 'id': b['id']},
    }, fatal=False)
    if res.get('_fehler'):
        print(f'  FEHLER: {fehler_text(res)}')
    else:
        print('  zugewiesen')


def setze_screenshots(tok):
    aid = app_id(tok)
    v = offene_version(tok, aid)
    print(f'  Version {v["attributes"]["versionString"]}')
    locs = api(tok, f'appStoreVersions/{v["id"]}/appStoreVersionLocalizations')
    for loc in locs.get('data', []):
        lc = loc['attributes']['locale']
        print(f'\n  Sprache {lc}')
        sets = api(tok, f'appStoreVersionLocalizations/{loc["id"]}/appScreenshotSets')
        vorhanden = {s['attributes']['screenshotDisplayType']: s['id']
                     for s in sets.get('data', [])}
        for ordner, typ in BILDER:
            pfade = sorted(
                os.path.join(WURZEL, ordner, f)
                for f in os.listdir(os.path.join(WURZEL, ordner))
                if f.endswith('.png') and f[0].isdigit())
            if not pfade:
                print(f'    {typ}: keine Bilder in {ordner}')
                continue
            sid = vorhanden.get(typ)
            if sid:
                alt = api(tok, f'appScreenshotSets/{sid}/appScreenshots')
                for s in alt.get('data', []):
                    if TROCKEN:
                        print(f'    [trocken] alt loeschen {s["id"]}')
                    else:
                        api(tok, f'appScreenshots/{s["id"]}', 'DELETE',
                            fatal=False)
                if not TROCKEN and alt.get('data'):
                    print(f'    {typ}: {len(alt["data"])} alte geloescht')
            elif TROCKEN:
                print(f'    [trocken] Set {typ} anlegen')
                sid = 'TROCKEN'
            else:
                neu = api(tok, 'appScreenshotSets', 'POST', {
                    'data': {'type': 'appScreenshotSets',
                             'attributes': {'screenshotDisplayType': typ},
                             'relationships': {'appStoreVersionLocalization': {
                                 'data': {'type': 'appStoreVersionLocalizations',
                                          'id': loc['id']}}}},
                }, fatal=False)
                if neu.get('_fehler'):
                    print(f'    {typ} nicht anlegbar: {fehler_text(neu)}')
                    continue
                sid = neu['data']['id']
                print(f'    Set {typ} angelegt')
            for p in pfade:
                datei_hoch(tok, 'appScreenshots', p, {
                    'appScreenshotSet': {
                        'data': {'type': 'appScreenshotSets', 'id': sid}}})


def setze_abo_screenshot(tok):
    aid = app_id(tok)
    pfad = os.path.join(WURZEL, 'store-assets', 'ios', 'paywall-review.png')
    if not os.path.exists(pfad):
        sys.exit(f'Fehlt: {pfad} (scripts/paywall-screenshot.mjs erzeugt ihn)')
    grp = api(tok, f'apps/{aid}/subscriptionGroups')
    for g in grp.get('data', []):
        subs = api(tok, f'subscriptionGroups/{g["id"]}/subscriptions')
        for s in subs.get('data', []):
            a = s['attributes']
            print(f'\n  {a.get("productId")}  {a.get("state")}')
            vorher = api(tok, f'subscriptions/{s["id"]}/appStoreReviewScreenshot',
                         fatal=False)
            if vorher.get('data'):
                alt = vorher['data']['id']
                if TROCKEN:
                    print(f'    [trocken] alten Screenshot loeschen {alt}')
                else:
                    api(tok, f'subscriptionAppStoreReviewScreenshots/{alt}',
                        'DELETE', fatal=False)
                    print('    alten geloescht')
            datei_hoch(tok, 'subscriptionAppStoreReviewScreenshots', pfad, {
                'subscription': {'data': {'type': 'subscriptions',
                                          'id': s['id']}}})


# Antwort auf die Ablehnung vom 29.07. Der Pruefer sieht sonst nur, DASS
# sich etwas geaendert hat, nicht wo. Englisch, weil das App Review liest.
PRUEFNOTIZ = """What changed since the rejected build (1.0 build 3)

Guideline 1.4.1 - Safety, Physical Harm (missing sources)
Every article that touches health now ends with a permanently visible
"Sources" list - not collapsed, no tap required. Links open in Safari.
Coverage is complete: 24 knowledge articles (training, nutrition,
supplements, blood markers), 20 peptide articles and 8 diet articles.
Where to look, starting from the app's Library tab:
  Library > Training / Nutrition / Supplements / Blood values > any topic
  Library > Peptides > any substance
  Library > Diets > any diet
The TDEE calculator cites Mifflin-St Jeor (1990) next to its result.
Sources are real, verified references (PubMed, NIH, WHO, NEJM and similar).
Entries without a stable public link are listed bibliographically without a
URL rather than linked to an unreliable page.
The AI coach is instructed to name its sources and never to invent one.

Guideline 2.1(b) - Performance, App Completeness (subscription)
The auto-renewable subscriptions are submitted together with this version.
Both now carry a review screenshot of the paywall.
To reach the paywall in the app: Profile tab > "FullRep Premium" card.
A 7-day free trial is offered before any purchase.

Medical disclaimer
FullRep does not replace medical advice. A disclaimer appears on every
health-related screen, and a dedicated page is reachable at
Profile > Health notice.

Demo account (not required - the app is fully usable as a guest):
appreview@wellbooked.at / MyPeak-Review#2026
"""


def setze_pruefnotiz(tok):
    aid = app_id(tok)
    v = offene_version(tok, aid)
    print(f'  Version {v["attributes"]["versionString"]}')
    detail = api(tok, f'appStoreVersions/{v["id"]}/appStoreReviewDetail',
                 fatal=False)
    if TROCKEN:
        alt = (detail.get('data') or {}).get('attributes', {}).get('notes') or ''
        print(f'  [trocken] Notiz ersetzen ({len(alt)} -> {len(PRUEFNOTIZ)} Zeichen)')
        return
    if detail.get('data'):
        res = api(tok, f'appStoreReviewDetails/{detail["data"]["id"]}', 'PATCH', {
            'data': {'type': 'appStoreReviewDetails', 'id': detail['data']['id'],
                     'attributes': {'notes': PRUEFNOTIZ}},
        }, fatal=False)
    else:
        res = api(tok, 'appStoreReviewDetails', 'POST', {
            'data': {'type': 'appStoreReviewDetails',
                     'attributes': {'notes': PRUEFNOTIZ},
                     'relationships': {'appStoreVersion': {'data': {
                         'type': 'appStoreVersions', 'id': v['id']}}}},
        }, fatal=False)
    if res.get('_fehler'):
        print(f'  FEHLER: {fehler_text(res)}')
    else:
        print(f'  Notiz gesetzt ({len(PRUEFNOTIZ)} Zeichen)')


# Zustaende, in denen eine Einreichung die Version blockiert. UNRESOLVED_ISSUES
# ist der entscheidende: die Einreichung vom 18.07. steckt dort fest, haelt die
# Version besetzt, und Apple meldet beim naechsten Versuch nur
# "is not in valid state" — ohne zu sagen, dass es an einer alten Einreichung
# liegt. Wer nur nach WAITING_FOR_REVIEW sucht, sieht sie nicht.
BLOCKIERT = {'UNRESOLVED_ISSUES', 'READY_FOR_REVIEW', 'WAITING_FOR_REVIEW',
             'IN_REVIEW'}


def zeige_einreichungen(tok):
    aid = app_id(tok)
    subm = api(tok, f'apps/{aid}/reviewSubmissions?limit=20')
    if not subm.get('data'):
        print('  Keine Einreichungen.')
        return
    for s in subm.get('data', []):
        a = s['attributes']
        print(f'\n  {s["id"]}')
        print(f'    Zustand: {a.get("state")}  platform={a.get("platform")}')
        print(f'    eingereicht: {a.get("submittedDate")}')
        items = api(tok, f'reviewSubmissions/{s["id"]}/items', fatal=False)
        for i in items.get('data', []):
            ziele = [f'{n}={b["data"]["id"]}'
                     for n, b in (i.get('relationships') or {}).items()
                     if (b or {}).get('data')]
            print(f'    Element {i["attributes"].get("state")}: '
                  f'{", ".join(ziele) or "—"}')
        if not items.get('data'):
            print('    Elemente: keine')


def aufraeumen(tok):
    """Festhaengende Einreichungen zurueckziehen.

    Solange eine alte Einreichung die Version haelt, laesst sich keine neue
    anlegen — Apple sagt dazu nur "is not in valid state".
    """
    aid = app_id(tok)
    subm = api(tok, f'apps/{aid}/reviewSubmissions?limit=20')
    getan = False
    for s in subm.get('data', []):
        a = s['attributes']
        if a.get('state') not in BLOCKIERT:
            continue
        getan = True
        print(f'  {s["id"]}  {a.get("state")}  -> zurueckziehen')
        if TROCKEN:
            continue
        res = api(tok, f'reviewSubmissions/{s["id"]}', 'PATCH', {
            'data': {'type': 'reviewSubmissions', 'id': s['id'],
                     'attributes': {'canceled': True}},
        }, fatal=False)
        if res.get('_fehler'):
            print(f'    FEHLER: {fehler_text(res)}')
        else:
            print(f'    Zustand jetzt '
                  f'{res["data"]["attributes"].get("state")}')
    if not getan:
        print('  Keine blockierende Einreichung gefunden.')


def einreichen(tok):
    """Version + Abos in einer Einreichung zu Apple schicken.

    2.1(b) ist genau daran gescheitert, dass das IAP-Produkt nie mitkam.
    Ob die API das ueberhaupt annimmt, zeigt erst der Aufruf — Apples
    Dokumentation zaehlt die erlaubten Element-Typen nicht auf.
    """
    aid = app_id(tok)
    v = offene_version(tok, aid)
    print(f'  Version {v["attributes"]["versionString"]} '
          f'({v["attributes"].get("appStoreState")})')

    # Ohne Zustandsfilter holen und selbst aussortieren. Ein serverseitiger
    # Filter verschweigt, was man nicht abgefragt hat — genau so blieb die
    # festhaengende Einreichung vom 18.07. unsichtbar.
    offen = api(tok, f'apps/{aid}/reviewSubmissions?limit=20', fatal=False)
    lauf = [s for s in offen.get('data', [])
            if s['attributes'].get('state') in ('WAITING_FOR_REVIEW', 'IN_REVIEW')]
    if lauf:
        print(f'  Es laeuft schon eine Einreichung ({lauf[0]["attributes"]["state"]}) '
              f'— nichts zu tun.')
        return

    steckt = [s for s in offen.get('data', [])
              if s['attributes'].get('state') == 'UNRESOLVED_ISSUES']
    if steckt:
        print(f'  ABBRUCH: Einreichung {steckt[0]["id"]} steht auf '
              f'UNRESOLVED_ISSUES und haelt die Version besetzt.')
        print('  Deshalb meldet Apple "is not in valid state" — es fehlt kein')
        print('  Feld. Erst mit --aufraeumen zurueckziehen, dann erneut.')
        return

    entwurf = [s for s in offen.get('data', [])
               if s['attributes'].get('state') == 'READY_FOR_REVIEW']
    if entwurf:
        sub = entwurf[0]
        print(f'  Vorhandener Entwurf {sub["id"]} wird benutzt')
    elif TROCKEN:
        print('  [trocken] wuerde reviewSubmission anlegen')
        return
    else:
        res = api(tok, 'reviewSubmissions', 'POST', {
            'data': {'type': 'reviewSubmissions',
                     'attributes': {'platform': 'IOS'},
                     'relationships': {'app': {
                         'data': {'type': 'apps', 'id': aid}}}},
        }, fatal=False)
        if res.get('_fehler'):
            print(f'  Einreichung nicht anlegbar: {fehler_text(res)}')
            return
        sub = res['data']
        print(f'  Einreichung {sub["id"]} angelegt')

    drin = api(tok, f'reviewSubmissions/{sub["id"]}/items', fatal=False)
    hab = set()
    for i in drin.get('data', []):
        for name, bez in (i.get('relationships') or {}).items():
            if (bez or {}).get('data'):
                hab.add(bez['data']['id'])
    print(f'  bisher {len(drin.get("data", []))} Elemente')

    def anhaengen(bezug, art, ident, label):
        # Die Beziehung heisst im Singular ('appStoreVersion'), der Typ im
        # Plural ('appStoreVersions'). Beides gleich zu benennen quittiert
        # Apple mit "unknown relationship".
        if ident in hab:
            print(f'    {label}: schon enthalten')
            return
        if TROCKEN:
            print(f'    [trocken] {label} anhaengen')
            return
        res = api(tok, 'reviewSubmissionItems', 'POST', {
            'data': {'type': 'reviewSubmissionItems',
                     'relationships': {
                         'reviewSubmission': {'data': {
                             'type': 'reviewSubmissions', 'id': sub['id']}},
                         bezug: {'data': {'type': art, 'id': ident}}}},
        }, fatal=False)
        if res.get('_fehler'):
            print(f'    {label} NICHT angenommen: {fehler_text(res)}')
        else:
            print(f'    {label} angehaengt')

    anhaengen('appStoreVersion', 'appStoreVersions', v['id'],
              f'Version {v["attributes"]["versionString"]}')

    # Abos lassen sich NICHT anhaengen — 'subscription' ist keine Beziehung
    # an reviewSubmissionItems (am 31.07. am echten Endpunkt geprueft, Apple
    # antwortet "unknown relationship"). Sie fahren mit der Version mit,
    # sobald sie READY_TO_SUBMIT sind. Deshalb hier nur der Zustand: steht
    # eines auf MISSING_METADATA, geht die Version zwar durch, das Abo aber
    # nicht — und genau daran ist 2.1(b) gescheitert.
    print('  Abos (fahren mit der Version mit, nicht anhaengbar):')
    grp = api(tok, f'apps/{aid}/subscriptionGroups')
    offen_abo = []
    for g in grp.get('data', []):
        subs = api(tok, f'subscriptionGroups/{g["id"]}/subscriptions')
        for s in subs.get('data', []):
            a = s['attributes']
            print(f'    {a.get("productId")}: {a.get("state")}')
            if a.get('state') not in ('READY_TO_SUBMIT', 'APPROVED',
                                      'WAITING_FOR_REVIEW', 'IN_REVIEW'):
                offen_abo.append(a.get('productId'))
    if offen_abo and not TROTZDEM:
        # Harte Sperre, kein blosser Hinweis. Ginge die Version ohne die Abos
        # zur Pruefung, waere das exakt der Zustand, fuer den Apple am
        # 29.07. 2.1(b) vergeben hat — ein Fehlversuch kostet hier keine
        # Minuten, sondern eine weitere Ablehnung samt Wartezeit.
        print(f'\n  ABBRUCH: {", ".join(offen_abo)} noch nicht einreichbar.')
        print('  Die Version ginge durch, die Abos nicht — genau daran ist')
        print('  2.1(b) gescheitert. Erst klaeren, dann einreichen.')
        print('  Wer es trotzdem will: --trotzdem.')
        return

    if TROCKEN:
        print('  [trocken] wuerde submitted=true setzen')
        return
    res = api(tok, f'reviewSubmissions/{sub["id"]}', 'PATCH', {
        'data': {'type': 'reviewSubmissions', 'id': sub['id'],
                 'attributes': {'submitted': True}},
    }, fatal=False)
    if res.get('_fehler'):
        print(f'  ABSENDEN FEHLGESCHLAGEN: {fehler_text(res)}')
    else:
        print(f'  abgesendet — Zustand jetzt '
              f'{res["data"]["attributes"].get("state")}')


def diagnose(tok):
    """Warum laesst sich die Version nicht einreichen?

    Apple antwortet beim Einreichen nur "is not in valid state" und verweist
    auf "associated errors" — die stehen aber an den einzelnen Ressourcen.
    Hier werden die ueblichen Sperren einzeln abgefragt.
    """
    aid = app_id(tok)

    # App-weite Pflichtfelder. contentRightsDeclaration ist der Klassiker:
    # fehlt sie, sperrt sie die Einreichung, ohne dass an Version oder Abo
    # etwas fehlt — man sucht dann lange an der falschen Stelle.
    print('\n── App-weite Angaben ──')
    app = api(tok, f'apps/{aid}', fatal=False)
    aa = (app.get('data') or {}).get('attributes', {})
    for feld in ('primaryLocale', 'contentRightsDeclaration',
                 'availableInNewTerritories'):
        wert = aa.get(feld)
        marke = '  ⚠ nicht gesetzt' if wert is None else ''
        print(f'  {feld}: {wert!r}{marke}')

    v = offene_version(tok, aid)
    va = v['attributes']
    print(f'\n── Version {va["versionString"]} ({va.get("appStoreState")}) ──')
    for feld in ('releaseType', 'earliestReleaseDate', 'downloadable'):
        print(f'  {feld}: {va.get(feld)}')

    print('\n── Build + Exportbestimmungen ──')
    b = api(tok, f'appStoreVersions/{v["id"]}/build', fatal=False)
    if not b.get('data'):
        print('  KEIN Build zugewiesen — das allein blockiert die Einreichung.')
    else:
        ba = b['data']['attributes']
        ver = ba.get('version')
        enc = ba.get('usesNonExemptEncryption')
        print(f'  Build {ver}  {ba.get("processingState")}')
        print(f'  usesNonExemptEncryption: {enc!r}')
        if enc is None:
            print('  ⚠ unbeantwortet — ASC verlangt die Antwort vor dem '
                  'Einreichen. Mit --exportfrage beantworten.')

    print('\n── Texte je Sprache ──')
    locs = api(tok, f'appStoreVersions/{v["id"]}/appStoreVersionLocalizations')
    for loc in locs.get('data', []):
        a = loc['attributes']
        leer = [f for f in ('description', 'keywords', 'supportUrl',
                            'whatsNew', 'marketingUrl', 'promotionalText')
                if not a.get(f)]
        print(f'  {a["locale"]:8} leer: {", ".join(leer) or "nichts"}')

    # Apple hat die Alterseinstufung irgendwann vom appStoreVersion an den
    # appInfo verschoben. Beide Orte abfragen, sonst meldet man "fehlt",
    # obwohl sie nur woanders liegt.
    print('\n── Alterseinstufung ──')
    ar = api(tok, f'appStoreVersions/{v["id"]}/ageRatingDeclaration', fatal=False)
    print(f'  an der Version: {"gesetzt" if ar.get("data") else "nicht dort"}')
    for info in api(tok, f'apps/{aid}/appInfos').get('data', []):
        ai = api(tok, f'appInfos/{info["id"]}/ageRatingDeclaration', fatal=False)
        zustand = (info['attributes'].get('appStoreState')
                   or info['attributes'].get('state') or '?')
        print(f'  an appInfo {info["id"][:8]} ({zustand}): '
              f'{"gesetzt" if ai.get("data") else "FEHLT"}')

    print('\n── Abos: warum MISSING_METADATA ──')
    grp = api(tok, f'apps/{aid}/subscriptionGroups')
    for g in grp.get('data', []):
        gl = api(tok, f'subscriptionGroups/{g["id"]}/subscriptionGroupLocalizations',
                 fatal=False)
        print(f'  Gruppe {g["attributes"].get("referenceName")}: '
              f'{len(gl.get("data", []))} Lokalisierung(en)')
        subs = api(tok, f'subscriptionGroups/{g["id"]}/subscriptions')
        for s in subs.get('data', []):
            a = s['attributes']
            print(f'\n  {a.get("productId")}  {a.get("state")}')
            sl = api(tok, f'subscriptions/{s["id"]}/subscriptionLocalizations',
                     fatal=False)
            for loc in sl.get('data', []):
                la = loc['attributes']
                print(f'      {la.get("locale"):8} name={la.get("name")!r} '
                      f'beschreibung={"ja" if la.get("description") else "FEHLT"}')
            if not sl.get('data'):
                print('      Lokalisierungen: KEINE')
            pr = api(tok, f'subscriptions/{s["id"]}/prices?limit=3', fatal=False)
            print(f'      Preise hinterlegt: {len(pr.get("data", []))}')
            av = api(tok, f'subscriptions/{s["id"]}/subscriptionAvailability',
                     fatal=False)
            if av.get('data'):
                aa = av['data']['attributes']
                terr = api(tok, f'subscriptionAvailabilities/{av["data"]["id"]}'
                                f'/availableTerritories?limit=1', fatal=False)
                anz = (terr.get('meta') or {}).get('paging', {}).get('total', '?')
                print(f'      Verfuegbarkeit: alleNeuen={aa.get("availableInNewTerritories")} '
                      f'Laender={anz}')
            else:
                print('      Verfuegbarkeit: FEHLT — Abo ist nirgends verkaeuflich')
            shot = api(tok, f'subscriptions/{s["id"]}/appStoreReviewScreenshot',
                       fatal=False)
            d = shot.get('data')
            if d:
                sa = d['attributes']
                print(f'      Review-Screenshot: hochgeladen={sa.get("assetDeliveryState", {}).get("state")}')
            else:
                print('      Review-Screenshot: FEHLT')
            # Alles Erwartbare ist vorhanden und der Zustand bleibt trotzdem
            # MISSING_METADATA — also die Rohdaten zeigen, statt weiter zu
            # raten, welches Feld Apple vermisst.
            print(f'      roh: {json.dumps(a, ensure_ascii=False, sort_keys=True)}')
            for bez in ('introductoryOffers', 'promotionalOffers',
                        'promotedPurchase', 'offerCodes', 'images'):
                r = api(tok, f'subscriptions/{s["id"]}/{bez}?limit=1', fatal=False)
                if r.get('_fehler'):
                    print(f'      {bez}: (kein Endpunkt)')
                else:
                    dd = r.get('data')
                    anz = len(dd) if isinstance(dd, list) else (1 if dd else 0)
                    print(f'      {bez}: {anz}')


def abo_namen(tok):
    """Anzeigenamen der Abos von MyPeak auf FullRep ziehen.

    Die Produkt-IDs bleiben (nach Anlage unveraenderlich), aber der Name im
    Kaufdialog ist sichtbar — er darf nicht die alte Marke tragen.
    """
    aid = app_id(tok)
    for g in api(tok, f'apps/{aid}/subscriptionGroups').get('data', []):
        for art, pfad in (('subscriptionGroupLocalizations',
                           f'subscriptionGroups/{g["id"]}/subscriptionGroupLocalizations'),
                          (None, None)):
            if not art:
                continue
            for loc in api(tok, pfad, fatal=False).get('data', []):
                a = loc['attributes']
                neu = (a.get('name') or '').replace('MyPeak', 'FullRep')
                if not neu or neu == a.get('name'):
                    continue
                print(f'  Gruppe {a.get("locale")}: {a.get("name")!r} -> {neu!r}')
                if TROCKEN:
                    continue
                res = api(tok, f'{art}/{loc["id"]}', 'PATCH', {
                    'data': {'type': art, 'id': loc['id'],
                             'attributes': {'name': neu}},
                }, fatal=False)
                print('    gesetzt' if not res.get('_fehler')
                      else f'    FEHLER: {fehler_text(res)}')

        for s in api(tok, f'subscriptionGroups/{g["id"]}/subscriptions').get('data', []):
            pid = s['attributes'].get('productId')
            for loc in api(tok, f'subscriptions/{s["id"]}/subscriptionLocalizations',
                           fatal=False).get('data', []):
                a = loc['attributes']
                felder = {}
                for f in ('name', 'description'):
                    wert = a.get(f) or ''
                    if 'MyPeak' in wert:
                        felder[f] = wert.replace('MyPeak', 'FullRep')
                if not felder:
                    print(f'  {pid} {a.get("locale")}: steht schon richtig')
                    continue
                print(f'  {pid} {a.get("locale")}: {felder}')
                if TROCKEN:
                    continue
                res = api(tok, f'subscriptionLocalizations/{loc["id"]}', 'PATCH', {
                    'data': {'type': 'subscriptionLocalizations',
                             'id': loc['id'], 'attributes': felder},
                }, fatal=False)
                print('    gesetzt' if not res.get('_fehler')
                      else f'    FEHLER: {fehler_text(res)}')


def inhaberrechte(tok):
    """contentRightsDeclaration setzen — app-weites Pflichtfeld.

    FullRep zeigt keine Inhalte Dritter, für die Rechte nachzuweisen wären:
    Übungsfotos stammen aus der Public Domain (free-exercise-db), die
    Quellenangaben sind bibliografische Zitate. Also
    DOES_NOT_USE_THIRD_PARTY_CONTENT.
    """
    aid = app_id(tok)
    app = api(tok, f'apps/{aid}')
    jetzt = app['data']['attributes'].get('contentRightsDeclaration')
    soll = 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
    print(f'  contentRightsDeclaration: {jetzt!r} -> {soll}')
    if jetzt == soll:
        print('  steht schon so')
        return
    if TROCKEN:
        print('  [trocken] wuerde gesetzt')
        return
    res = api(tok, f'apps/{aid}', 'PATCH', {
        'data': {'type': 'apps', 'id': aid,
                 'attributes': {'contentRightsDeclaration': soll}},
    }, fatal=False)
    print('  gesetzt' if not res.get('_fehler')
          else f'  FEHLER: {fehler_text(res)}')


# Prueferhinweis am Abo. Gilt als optional — in den Rohdaten ist es aber das
# einzige leere Feld, und der Hinweis gehoert inhaltlich ohnehin dorthin.
ABO_NOTIZ = (
    'The subscription unlocks the AI coach, blood-marker guidance and the '
    'AI meal photo analysis. To reach it in the app: Profile tab > '
    '"FullRep Premium" card. A 7-day free trial is offered before any '
    'purchase, so the paywall can be reviewed without buying. '
    'No account is required — the app is fully usable as a guest.'
)


def abo_notiz(tok):
    aid = app_id(tok)
    for g in api(tok, f'apps/{aid}/subscriptionGroups').get('data', []):
        for s in api(tok, f'subscriptionGroups/{g["id"]}/subscriptions').get('data', []):
            a = s['attributes']
            if a.get('reviewNote') == ABO_NOTIZ:
                print(f'  {a.get("productId")}: steht schon richtig')
                continue
            print(f'  {a.get("productId")}: Notiz setzen ({len(ABO_NOTIZ)} Zeichen)')
            if TROCKEN:
                continue
            res = api(tok, f'subscriptions/{s["id"]}', 'PATCH', {
                'data': {'type': 'subscriptions', 'id': s['id'],
                         'attributes': {'reviewNote': ABO_NOTIZ}},
            }, fatal=False)
            if res.get('_fehler'):
                print(f'    FEHLER: {fehler_text(res)}')
            else:
                neu = res['data']['attributes'].get('state')
                print(f'    gesetzt — Zustand jetzt {neu}')


def exportfrage(tok, wert=False):
    """Die Frage nach Verschluesselung am Build beantworten.

    Bleibt sie offen, laesst ASC die Version nicht einreichen. FullRep nutzt
    nur HTTPS — das faellt unter die Ausnahme, also 'false'.
    """
    aid = app_id(tok)
    v = offene_version(tok, aid)
    b = api(tok, f'appStoreVersions/{v["id"]}/build', fatal=False)
    if not b.get('data'):
        sys.exit('  Kein Build zugewiesen.')
    bid = b['data']['id']
    jetzt = b['data']['attributes'].get('usesNonExemptEncryption')
    print(f'  Build {b["data"]["attributes"].get("version")}: '
          f'usesNonExemptEncryption {jetzt!r} -> {wert}')
    if jetzt == wert:
        print('  steht schon so')
        return
    if TROCKEN:
        print('  [trocken] wuerde gesetzt')
        return
    res = api(tok, f'builds/{bid}', 'PATCH', {
        'data': {'type': 'builds', 'id': bid,
                 'attributes': {'usesNonExemptEncryption': wert}},
    }, fatal=False)
    if res.get('_fehler'):
        print(f'  FEHLER: {fehler_text(res)}')
    else:
        print('  gesetzt')


def zeige_status(tok):
    aid = app_id(tok)

    print('\n── Anzeigename je Sprache ──')
    infos = api(tok, f'apps/{aid}/appInfos')
    for info in infos.get('data', []):
        zustand = info['attributes'].get('appStoreState') or \
                  info['attributes'].get('state') or '?'
        print(f'  appInfo {info["id"]}  Zustand {zustand}')
        locs = api(tok, f'appInfos/{info["id"]}/appInfoLocalizations')
        for loc in locs.get('data', []):
            a = loc['attributes']
            print(f'    {a["locale"]:8} name={a.get("name")!r}  '
                  f'subtitle={a.get("subtitle")!r}')

    print('\n── Versionen ──')
    vers = api(tok, f'apps/{aid}/appStoreVersions?limit=5')
    for v in vers.get('data', []):
        a = v['attributes']
        print(f'  {a["versionString"]:8} {a.get("appStoreState")}  '
              f'platform={a.get("platform")}  id={v["id"]}')
        b = api(tok, f'appStoreVersions/{v["id"]}/build', fatal=False)
        if b.get('data'):
            print(f'      zugewiesener Build: {b["data"]["attributes"].get("version")}')
        else:
            print('      zugewiesener Build: keiner')

    print('\n── Builds (neueste zuerst) ──')
    builds = api(tok, f'builds?filter[app]={aid}&limit=5&sort=-version')
    for b in builds.get('data', []):
        a = b['attributes']
        print(f'  Build {a.get("version"):4}  {a.get("processingState")}  '
              f'hochgeladen {a.get("uploadedDate")}  id={b["id"]}')

    print('\n── Abos ──')
    grp = api(tok, f'apps/{aid}/subscriptionGroups', fatal=False)
    for g in grp.get('data', []):
        subs = api(tok, f'subscriptionGroups/{g["id"]}/subscriptions', fatal=False)
        for s in subs.get('data', []):
            a = s['attributes']
            print(f'  {a.get("productId")}  {a.get("state")}  id={s["id"]}')
            shots = api(tok, f'subscriptions/{s["id"]}/appStoreReviewScreenshot',
                        fatal=False)
            print(f'      Review-Screenshot: '
                  f'{"vorhanden" if shots.get("data") else "FEHLT"}')

    print('\n── Screenshots je Version ──')
    for v in vers.get('data', [])[:1]:
        locs = api(tok, f'appStoreVersions/{v["id"]}/appStoreVersionLocalizations')
        for loc in locs.get('data', []):
            lc = loc['attributes']['locale']
            sets = api(tok, f'appStoreVersionLocalizations/{loc["id"]}/appScreenshotSets')
            for st in sets.get('data', []):
                typ = st['attributes']['screenshotDisplayType']
                shots = api(tok, f'appScreenshotSets/{st["id"]}/appScreenshots')
                print(f'  {lc:8} {typ:28} {len(shots.get("data", []))} Bilder')

    print('\n── Offene Einreichungen ──')
    subm = api(tok, f'apps/{aid}/reviewSubmissions?limit=5', fatal=False)
    for s in subm.get('data', []):
        a = s['attributes']
        print(f'  {a.get("state")}  platform={a.get("platform")}  id={s["id"]}')
        items = api(tok, f'reviewSubmissions/{s["id"]}/items', fatal=False)
        print(f'      Elemente: {len(items.get("data", []))}')


def main():
    global TROCKEN, TROTZDEM
    p = argparse.ArgumentParser()
    p.add_argument('--status', action='store_true',
                   help='Zeigt Name, Versionen, Builds, Abos, Screenshots')
    p.add_argument('--name', action='store_true',
                   help='Anzeigename + Untertitel auf FullRep setzen')
    p.add_argument('--build', metavar='NR',
                   help='Diesen Build der offenen Version zuweisen')
    p.add_argument('--screenshots', action='store_true',
                   help='iPhone- und iPad-Screenshots ersetzen')
    p.add_argument('--abo-screenshot', action='store_true',
                   help='Paywall-Bild als Review-Screenshot an alle Abos')
    p.add_argument('--warum', action='store_true',
                   help='Was blockiert die Einreichung? (liest nur)')
    p.add_argument('--abo-namen', action='store_true',
                   help='Abo-Anzeigenamen von MyPeak auf FullRep ziehen')
    p.add_argument('--einreichungen', action='store_true',
                   help='alle Einreichungen samt Zustand und Elementen zeigen')
    p.add_argument('--aufraeumen', action='store_true',
                   help='festhaengende Einreichungen zurueckziehen')
    p.add_argument('--abo-notiz', action='store_true',
                   help='Prueferhinweis am Abo setzen (einziges leeres Feld)')
    p.add_argument('--inhaberrechte', action='store_true',
                   help='contentRightsDeclaration setzen (app-weites Pflichtfeld)')
    p.add_argument('--exportfrage', action='store_true',
                   help='usesNonExemptEncryption am Build auf false setzen')
    p.add_argument('--pruefnotiz', action='store_true',
                   help='App-Review-Notiz: was sich seit der Ablehnung aendert')
    p.add_argument('--einreichen', action='store_true',
                   help='Version samt Abos zur Pruefung schicken')
    p.add_argument('--alles', action='store_true',
                   help='name, build 4, screenshots, abo-screenshot, '
                        'pruefnotiz, einreichen')
    p.add_argument('--trotzdem', action='store_true',
                   help='einreichen, auch wenn Abos nicht mitkoennen')
    p.add_argument('--dry-run', action='store_true',
                   help='nur zeigen, nichts an Apple senden')
    a = p.parse_args()
    _sperre_pruefen(a)
    TROCKEN = a.dry_run
    TROTZDEM = a.trotzdem

    tat = [a.status, a.name, a.build, a.screenshots, a.abo_screenshot,
           a.warum, a.einreichungen, a.aufraeumen, a.abo_namen, a.abo_notiz,
           a.inhaberrechte, a.exportfrage, a.pruefnotiz,
           a.einreichen, a.alles]
    if not any(tat):
        p.error('Einen Befehl angeben, z. B. --status')

    tok = token()
    if a.status:
        zeige_status(tok)
    if a.alles:
        for titel, fn in (('Anzeigename', lambda: setze_namen(tok)),
                          ('Build 4', lambda: setze_build(tok, '4')),
                          ('Screenshots', lambda: setze_screenshots(tok)),
                          ('Abo-Screenshot', lambda: setze_abo_screenshot(tok)),
                          ('Abo-Namen', lambda: abo_namen(tok)),
                          ('Abo-Notiz', lambda: abo_notiz(tok)),
                          ('Inhaberrechte', lambda: inhaberrechte(tok)),
                          ('Pruefnotiz', lambda: setze_pruefnotiz(tok)),
                          ('Einreichen', lambda: einreichen(tok))):
            print(f'\n═══ {titel} ═══')
            fn()
        return
    if a.name:
        setze_namen(tok)
    if a.build:
        setze_build(tok, a.build)
    if a.screenshots:
        setze_screenshots(tok)
    if a.abo_screenshot:
        setze_abo_screenshot(tok)
    if a.warum:
        diagnose(tok)
    if a.abo_namen:
        abo_namen(tok)
    if a.einreichungen:
        zeige_einreichungen(tok)
    if a.aufraeumen:
        aufraeumen(tok)
    if a.abo_notiz:
        abo_notiz(tok)
    if a.inhaberrechte:
        inhaberrechte(tok)
    if a.exportfrage:
        exportfrage(tok)
    if a.pruefnotiz:
        setze_pruefnotiz(tok)
    if a.einreichen:
        einreichen(tok)


if __name__ == '__main__':
    main()
