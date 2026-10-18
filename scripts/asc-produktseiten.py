#!/usr/bin/env python3
"""Eigene Produktseiten im App Store (Custom Product Pages) anlegen.

Eine eigene Produktseite ist eine zweite Fassung der Store-Seite mit eigenem
Werbetext, eigener Kopfzeile und — seit 2025 — eigenen Suchbegriffen: Wer
„riichi" sucht, landet auf der Riichi-Seite statt auf der allgemeinen.
Quelle ist `store/produktseiten.json`.

  python3 scripts/asc-produktseiten.py                       # nur ansehen
  python3 scripts/asc-produktseiten.py --anlegen             # Trockenlauf
  python3 scripts/asc-produktseiten.py --anlegen --schreiben # anlegen
  python3 scripts/asc-produktseiten.py --einreichen --schreiben

Screenshots werden NICHT hochgeladen: Die Seite entsteht aus der live
geschalteten Version als Vorlage (`appStoreVersionTemplate`) und übernimmt
deren Bilder. Die Kopfzeile ordnet man in App Store Connect von Hand zu.

Die Suchbegriffe müssen in den Keywords der App stehen (store-texte.json).
Ein Begriff, der dort fehlt, wird gemeldet und übersprungen — er lässt sich
erst mit der nächsten App-Version ergänzen.

Bereits vorhandene Seiten (gleicher Name) werden nicht doppelt angelegt;
Werbetext und Suchbegriffe werden dort nachgezogen.
"""
import argparse
import time
import hashlib
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
APPLE_LOCALE = {'it-IT': 'it', 'ja-JP': 'ja'}

spec = importlib.util.spec_from_file_location('asc', os.path.join(HIER, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()


class ApiFehler(Exception):
    pass


def call(methode, pfad, daten=None):
    req = urllib.request.Request(asc.BASE + pfad, method=methode,
                                 data=json.dumps(daten).encode() if daten is not None else None)
    req.add_header('Authorization', f'Bearer {TOK}')
    if daten is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            roh = r.read()
            return json.loads(roh) if roh else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors='replace')
        # Ganzer Text: Apple legt die eigentliche Ursache gern in
        # errors[].meta.associatedErrors ab, nicht in title/detail.
        text = text[:4000]
        raise ApiFehler(f'HTTP {e.code} bei {methode} {pfad}: {text}') from None


def alle(pfad):
    """GET mit Blättern über links.next."""
    daten = []
    while pfad:
        antwort = call('GET', pfad)
        daten += antwort.get('data', [])
        naechste = antwort.get('links', {}).get('next')
        pfad = naechste[len(asc.BASE):] if naechste else None
    return daten


SHOTS = os.path.join(HIER, '..', 'store', 'ios-screenshots')
# Gleiche Zuordnung wie upload-ios-screenshots.py: de-DE deutsche Bilder,
# alle anderen Sprachen die englischen.
SETS = {'APP_IPHONE_65': ('iphone65', 'iphone65-en'),
        'APP_IPAD_PRO_3GEN_129': ('ipad13', 'ipad13-en')}


def roh_call(methode, url, roh, kopf):
    req = urllib.request.Request(url, method=methode, data=roh)
    for k, v in kopf.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as r:
        r.read()


def bilder_hochladen(loc_id, loc, zuerst, schreiben):
    """Fehlende Screenshot-Saetze einer Seiten-Sprache auffuellen.

    ⚠ Die Vorlage (appStoreVersionTemplate) kopiert die Bilder NUR in die
    Sprache, die beim Anlegen inline mitkommt — alle spaeter angelegten
    Sprachen stehen ohne Bilder da, und ohne Bilder lehnt Apple die
    Einreichung ab („This resource cannot be reviewed"). Am 11.10.2026
    genau so passiert.
    Das Motiv der Seite (`zuerst`, z. B. „5-riichi") kommt an Position 1."""
    saetze = alle(f'/v1/appCustomProductPageLocalizations/{loc_id}/appScreenshotSets?limit=20')
    typen = {x['attributes']['screenshotDisplayType'] for x in saetze}
    for typ, (de, en) in SETS.items():
        ordner = os.path.join(SHOTS, de if loc == 'de-DE' else en)
        if typ in typen:
            # Die aus der Vorlage kopierte Sprache hat schon Bilder — aber nur die
            # der App-Version. Fehlt das Seiten-Motiv (Duell, 18.10.2026: kein
            # Duell-Bild auf der Hauptseite), hier anhängen und nach vorn ziehen.
            if zuerst:
                motiv_nach_vorn(next(x for x in saetze if x['attributes']['screenshotDisplayType'] == typ),
                                ordner, loc, zuerst, schreiben)
            continue
        dateien = sorted(f for f in os.listdir(ordner) if f.endswith('.png'))
        dateien.sort(key=lambda f: 0 if zuerst and f.startswith(zuerst) else 1)
        if not schreiben:
            print(f'  {loc:6} TROCKENLAUF: würde {typ} hochladen: {dateien}')
            continue
        sid = call('POST', '/v1/appScreenshotSets', {'data': {
            'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': typ},
            'relationships': {'appCustomProductPageLocalization': {'data': {
                'type': 'appCustomProductPageLocalizations', 'id': loc_id}}}}})['data']['id']
        for name in dateien:
            ein_bild(sid, ordner, name)
        print(f'  {loc:6} {typ}: {len(dateien)} Bilder hochgeladen (zuerst {dateien[0]})')


def ein_bild(sid, ordner, name):
    roh = open(os.path.join(ordner, name), 'rb').read()
    r = call('POST', '/v1/appScreenshots', {'data': {
        'type': 'appScreenshots', 'attributes': {'fileName': name, 'fileSize': len(roh)},
        'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sid}}}}})
    bild = r['data']['id']
    op = r['data']['attributes']['uploadOperations'][0]
    roh_call(op['method'], op['url'], roh, {h['name']: h['value'] for h in op.get('requestHeaders', [])})
    call('PATCH', f'/v1/appScreenshots/{bild}', {'data': {
        'type': 'appScreenshots', 'id': bild,
        'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(roh).hexdigest()}}})
    return bild


def motiv_nach_vorn(satz, ordner, loc, zuerst, schreiben):
    typ = satz['attributes']['screenshotDisplayType']
    bilder = alle(f"/v1/appScreenshotSets/{satz['id']}/appScreenshots?limit=20")
    treffer = [b['id'] for b in bilder if (b['attributes'].get('fileName') or '').startswith(zuerst)]
    if bilder and treffer and bilder[0]['id'] == treffer[0]:
        return
    datei = next((f for f in sorted(os.listdir(ordner)) if f.startswith(zuerst) and f.endswith('.png')), None)
    if not datei:
        sys.exit(f'{loc} {typ}: Motiv {zuerst} fehlt in {ordner}')
    if not schreiben:
        print(f'  {loc:6} TROCKENLAUF: würde {typ} um {datei} ergänzen und an Position 1 setzen')
        return
    if not treffer:
        if len(bilder) >= 10:
            sys.exit(f'{loc} {typ}: schon 10 Bilder, kein Platz für {datei}')
        treffer = [ein_bild(satz['id'], ordner, datei)]
    reihe = treffer[:1] + [b['id'] for b in bilder if b['id'] != treffer[0]]
    call('PATCH', f"/v1/appScreenshotSets/{satz['id']}/relationships/appScreenshots",
         {'data': [{'type': 'appScreenshots', 'id': i} for i in reihe]})
    print(f'  {loc:6} {typ}: {datei} an Position 1')


def entwurf():
    """Offene, noch nicht abgeschickte Einreichung (READY_FOR_REVIEW) oder None.
    Apple erlaubt davon nur eine; ein abgebrochener Lauf hinterlaesst sie."""
    for sub in alle(f'/v1/reviewSubmissions?filter[app]={asc.APP_ID}&filter[state]=READY_FOR_REVIEW&limit=20'):
        if not sub['attributes'].get('submittedDate'):
            return sub
    return None


def aus_entwurf_loesen(v_ids, schreiben):
    """Seiten-Versionen aus dem Entwurf nehmen — erst dann sind sie wieder
    PREPARE_FOR_SUBMISSION und ihre Sprachen bearbeitbar."""
    sub = entwurf()
    if not sub:
        return
    for it in alle(f"/v1/reviewSubmissions/{sub['id']}/items?include=appCustomProductPageVersion&limit=50"):
        ziel = ((it.get('relationships') or {}).get('appCustomProductPageVersion') or {}).get('data') or {}
        if ziel.get('id') in v_ids:
            if schreiben:
                call('DELETE', f"/v1/reviewSubmissionItems/{it['id']}")
            print(f"  aus Entwurf {sub['id'][:8]} gelöst: {ziel['id'][:8]}" + ('' if schreiben else ' (TROCKENLAUF)'))


def live_version():
    for v in alle(f'/v1/apps/{asc.APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20'):
        if v['attributes']['appStoreState'] == 'READY_FOR_SALE':
            return v
    sys.exit('Keine live geschaltete Version gefunden (READY_FOR_SALE).')


def keyword_ids(loc_typ, loc_id):
    """Suchbegriffe einer Lokalisierung. AppKeyword hat keine Attribute —
    die id IST der Begriff (so jedenfalls die Annahme; der Lesemodus druckt
    sie aus, damit man es sieht)."""
    return [k['id'] for k in alle(f'/v1/{loc_typ}/{loc_id}/relationships/searchKeywords?limit=200')]


def zeige(version):
    print(f"Live-Version {version['attributes']['versionString']}  id={version['id']}")
    for loc in alle(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50"):
        a = loc['attributes']
        try:
            ids = keyword_ids('appStoreVersionLocalizations', loc['id'])
        except ApiFehler as e:
            ids = [f'({e})']
        print(f"  {a['locale']:6} keywords-Feld: {a.get('keywords')}")
        print(f"         searchKeywords-IDs: {ids}")
    seiten = alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50')
    print(f'\nEigene Produktseiten: {len(seiten)}')
    for s in seiten:
        a = s['attributes']
        print(f"  {a['name']!r:16} sichtbar={a.get('visible')}  {a.get('url')}")
        for v in alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10"):
            va = v['attributes']
            print(f"     Version {va.get('version')}  {va.get('state')}  id={v['id']}")
            for loc in alle(f"/v1/appCustomProductPageVersions/{v['id']}/appCustomProductPageLocalizations?limit=50"):
                try:
                    ids = keyword_ids('appCustomProductPageLocalizations', loc['id'])
                except ApiFehler as e:
                    ids = [f'({e})']
                try:
                    saetze = alle(f"/v1/appCustomProductPageLocalizations/{loc['id']}/appScreenshotSets?limit=20")
                    bilder = [s2['attributes'].get('screenshotDisplayType') for s2 in saetze]
                except ApiFehler as e:
                    bilder = [f'({str(e)[:200]})']
                print(f"       {loc['attributes']['locale']:6} Suchbegriffe {ids}  Screenshot-Saetze {bilder}")
    # Offene Einreichungen samt Eintraegen — ein abgebrochener Versuch bleibt
    # als Entwurf liegen und muss weiterverwendet oder verworfen werden.
    for sub in alle(f'/v1/reviewSubmissions?filter[app]={asc.APP_ID}&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES,WAITING_FOR_REVIEW,IN_REVIEW&limit=20'):
        print(f"\nEinreichung {sub['id']}  {sub['attributes'].get('state')}")
        for it in alle(f"/v1/reviewSubmissions/{sub['id']}/items?limit=20"):
            print(f"   Eintrag {it['id']}  {it['attributes'].get('state')}  {json.dumps(it.get('relationships', {}))[:0]}")
    return seiten


def anlegen(cfg, version, vorhanden, schreiben):
    # Begriffe, die die App je Sprache wirklich hat — nur die lassen sich zuordnen.
    app_kw = {}
    for loc in alle(f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50"):
        a = loc['attributes']
        felder = {w.strip().lower() for w in (a.get('keywords') or '').split(',') if w.strip()}
        try:
            ids = keyword_ids('appStoreVersionLocalizations', loc['id'])
        except ApiFehler:
            ids = []
        app_kw[a['locale']] = (felder, ids)

    nach_name = {s['attributes']['name']: s for s in vorhanden}
    for seite in cfg['seiten']:
        name = seite['name']
        print(f'\n=== Seite {name!r} ===')
        if name in nach_name:
            seite_id = nach_name[name]['id']
            print(f'  vorhanden (id={seite_id}) — ziehe Texte/Suchbegriffe nach')
        elif not schreiben:
            print(f"  TROCKENLAUF: würde anlegen, Vorlage = Version {version['attributes']['versionString']}")
            seite_id = None
        else:
            antwort = call('POST', '/v1/appCustomProductPages', {
                'data': {
                    'type': 'appCustomProductPages',
                    'attributes': {'name': name},
                    'relationships': {
                        'app': {'data': {'type': 'apps', 'id': asc.APP_ID}},
                        'appStoreVersionTemplate': {'data': {'type': 'appStoreVersions', 'id': version['id']}},
                        'appCustomProductPageVersions': {'data': [
                            {'type': 'appCustomProductPageVersions', 'id': '${neu-version}'}]},
                    },
                },
                'included': [
                    {'type': 'appCustomProductPageVersions', 'id': '${neu-version}',
                     'relationships': {'appCustomProductPageLocalizations': {'data': [
                         {'type': 'appCustomProductPageLocalizations', 'id': '${neu-en}'}]}}},
                    {'type': 'appCustomProductPageLocalizations', 'id': '${neu-en}',
                     'attributes': {'locale': 'en-US', 'promotionalText': seite['promo']['en-US']}},
                ],
            })
            seite_id = antwort['data']['id']
            print(f"  angelegt: id={seite_id}  {antwort['data']['attributes'].get('url')}")

        if not seite_id:
            for play_loc, promo in seite['promo'].items():
                loc = APPLE_LOCALE.get(play_loc, play_loc)
                felder, _ = app_kw.get(loc, (set(), []))
                kws = seite['keywords'].get(play_loc, [])
                fehlt = [k for k in kws if k.lower() not in felder]
                print(f'  {loc:6} Werbetext {len(promo)} Zeichen, Suchbegriffe {kws}'
                      + (f'  ⚠ nicht in den App-Keywords: {fehlt}' if fehlt else ''))
            continue

        versionen = alle(f'/v1/appCustomProductPages/{seite_id}/appCustomProductPageVersions?limit=10')
        haengend = [v['id'] for v in versionen if v['attributes'].get('state') == 'READY_FOR_REVIEW']
        if haengend:
            aus_entwurf_loesen(set(haengend), schreiben)
            if schreiben:
                versionen = alle(f'/v1/appCustomProductPages/{seite_id}/appCustomProductPageVersions?limit=10')
            else:
                for v in versionen:
                    if v['id'] in haengend:
                        v['attributes']['state'] = 'PREPARE_FOR_SUBMISSION'
        bearbeitbar = [v for v in versionen if v['attributes'].get('state') == 'PREPARE_FOR_SUBMISSION']
        if not bearbeitbar:
            print('  keine bearbeitbare Version (schon eingereicht?) — übersprungen')
            continue
        v_id = bearbeitbar[0]['id']
        locs = {l['attributes']['locale']: l for l in
                alle(f'/v1/appCustomProductPageVersions/{v_id}/appCustomProductPageLocalizations?limit=50')}

        for play_loc, promo in seite['promo'].items():
            loc = APPLE_LOCALE.get(play_loc, play_loc)
            if len(promo) > 170:
                sys.exit(f'{name} {loc}: Werbetext {len(promo)} > 170 Zeichen')
            if loc not in locs:
                if not schreiben:
                    print(f'  {loc:6} TROCKENLAUF: würde Sprache anlegen')
                    continue
                locs[loc] = call('POST', '/v1/appCustomProductPageLocalizations', {'data': {
                    'type': 'appCustomProductPageLocalizations',
                    'attributes': {'locale': loc, 'promotionalText': promo},
                    'relationships': {'appCustomProductPageVersion': {'data': {
                        'type': 'appCustomProductPageVersions', 'id': v_id}}}}})['data']
                print(f'  {loc:6} Sprache angelegt')
            elif schreiben:
                call('PATCH', f"/v1/appCustomProductPageLocalizations/{locs[loc]['id']}", {'data': {
                    'type': 'appCustomProductPageLocalizations', 'id': locs[loc]['id'],
                    'attributes': {'promotionalText': promo}}})
                print(f'  {loc:6} Werbetext gesetzt')

            if loc in locs:
                bilder_hochladen(locs[loc]['id'], loc, seite.get('zuerst'), schreiben)

            # Suchbegriffe: nur solche, die die App selbst führt.
            felder, ids = app_kw.get(loc, (set(), []))
            wunsch = seite['keywords'].get(play_loc, [])
            treffer = [i for i in ids if i.lower() in {w.lower() for w in wunsch}]
            fehlt = [w for w in wunsch if w.lower() not in felder]
            if fehlt:
                print(f'  {loc:6} ⚠ nicht in den App-Keywords, übersprungen: {fehlt}')
            if not treffer:
                print(f'  {loc:6} ⚠ keine passende Keyword-ID gefunden (IDs der App: {ids[:12]})')
                continue
            if loc in locs:
                schon = set(keyword_ids('appCustomProductPageLocalizations', locs[loc]['id']))
                treffer = [i for i in treffer if i not in schon]
                if not treffer:
                    continue
            if not schreiben:
                print(f'  {loc:6} TROCKENLAUF: würde Suchbegriffe {treffer} zuordnen')
                continue
            try:
                call('POST', f"/v1/appCustomProductPageLocalizations/{locs[loc]['id']}/relationships/searchKeywords",
                     {'data': [{'type': 'appKeywords', 'id': i} for i in treffer]})
                print(f'  {loc:6} Suchbegriffe zugeordnet: {treffer}')
            except ApiFehler as e:
                print(f'  {loc:6} ⚠ Suchbegriffe nicht zugeordnet: {e}')


def zurueckziehen(schreiben):
    """Laufende Prüfungen zurückziehen, die NUR Produktseiten enthalten (nie
    eine App-Version), und warten, bis die Seiten wieder bearbeitbar sind."""
    for sub in alle(f'/v1/reviewSubmissions?filter[app]={asc.APP_ID}'
                    '&filter[state]=WAITING_FOR_REVIEW,READY_FOR_REVIEW&limit=20'):
        items = alle(f"/v1/reviewSubmissions/{sub['id']}/items?include=appCustomProductPageVersion,appStoreVersion&limit=50")
        cpp = [((it.get('relationships') or {}).get('appCustomProductPageVersion') or {}).get('data') for it in items]
        if not items or not all(cpp):
            continue
        if not sub['attributes'].get('submittedDate'):
            continue  # Entwurf, nicht abgeschickt
        print(f"Prüfung {sub['id']} ({sub['attributes'].get('state')}) mit {len(items)} Produktseite(n)")
        if not schreiben:
            print('  TROCKENLAUF: würde zurückziehen')
            continue
        call('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {
            'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'canceled': True}}})
        print('  zurückgezogen — warte, bis die Seiten wieder bearbeitbar sind')
        ids = {c['id'] for c in cpp}
        for _ in range(60):
            zust = [call('GET', f'/v1/appCustomProductPageVersions/{i}')['data']['attributes'].get('state') for i in ids]
            if all(z == 'PREPARE_FOR_SUBMISSION' for z in zust):
                break
            time.sleep(5)
        print(f'  Zustand: {zust}')


def einreichen(vorhanden, schreiben):
    """Alle bearbeitbaren Seiten-Versionen in EINE Prüfung packen."""
    versionen = []
    for s in vorhanden:
        for v in alle(f"/v1/appCustomProductPages/{s['id']}/appCustomProductPageVersions?limit=10"):
            if v['attributes'].get('state') == 'PREPARE_FOR_SUBMISSION':
                versionen.append((s['attributes']['name'], v['id']))
    if not versionen:
        # Seiten, die schon im Entwurf stecken, stehen auf READY_FOR_REVIEW —
        # dann fehlt nur noch das Abschicken des Entwurfs (so am 11./12.10.,
        # als das Limit von 2 laufenden Prüfungen das Abschicken blockierte).
        sub = entwurf()
        if sub and alle(f"/v1/reviewSubmissions/{sub['id']}/items?limit=50"):
            print(f"Entwurf {sub['id']} hat schon Einträge — schicke nur ab")
            if not schreiben:
                print('TROCKENLAUF — nichts eingereicht')
                return
            call('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {
                'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'submitted': True}}})
            print(f"Eingereicht, reviewSubmission {sub['id']}")
            return
        print('Nichts einzureichen.')
        return
    # ⚠ Neue Seiten-Versionen übernehmen die Suchbegriffe NICHT (13.10.2026,
    # Version 2 von Riichi/Connect ging so ohne Begriffe in die Prüfung).
    leer = []
    for name, v_id in versionen:
        for l in alle(f'/v1/appCustomProductPageVersions/{v_id}/appCustomProductPageLocalizations?limit=50'):
            if not keyword_ids('appCustomProductPageLocalizations', l['id']):
                leer.append(f"{name}/{l['attributes']['locale']}")
    if leer:
        sys.exit('Ohne Suchbegriffe, nicht eingereicht: ' + ', '.join(leer)
                 + '\n→ zuerst mit --anlegen nachziehen.')
    print('Einzureichen: ' + ', '.join(n for n, _ in versionen))
    if not schreiben:
        print('TROCKENLAUF — nichts eingereicht')
        return
    # Läuft gerade eine App-Prüfung, nimmt Apple keine zweite Einreichung an.
    # Dann meldet die API 409 und es bleibt beim Hinweis.
    sub = entwurf()
    if sub:
        print(f"  verwende offenen Entwurf {sub['id']}")
    else:
        sub = call('POST', '/v1/reviewSubmissions', {'data': {
            'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
            'relationships': {'app': {'data': {'type': 'apps', 'id': asc.APP_ID}}}}})['data']
    for name, v_id in versionen:
        call('POST', '/v1/reviewSubmissionItems', {'data': {
            'type': 'reviewSubmissionItems', 'relationships': {
                'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub['id']}},
                'appCustomProductPageVersion': {'data': {'type': 'appCustomProductPageVersions', 'id': v_id}}}}})
        print(f'  + {name}')
    call('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {
        'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'submitted': True}}})
    print(f"Eingereicht, reviewSubmission {sub['id']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--anlegen', action='store_true')
    ap.add_argument('--einreichen', action='store_true')
    ap.add_argument('--zurueckziehen', action='store_true',
                    help='laufende Prüfung, die nur Produktseiten enthält, zurückziehen')
    ap.add_argument('--schreiben', action='store_true', help='wirklich ändern (sonst Trockenlauf)')
    a = ap.parse_args()
    with open(os.path.join(HIER, '..', 'store', 'produktseiten.json'), encoding='utf-8') as fh:
        cfg = json.load(fh)
    version = live_version()
    if a.zurueckziehen:
        zurueckziehen(a.schreiben)
    vorhanden = zeige(version)
    if a.anlegen:
        anlegen(cfg, version, vorhanden, a.schreiben)
        vorhanden = alle(f'/v1/apps/{asc.APP_ID}/appCustomProductPages?limit=50')
    if a.einreichen:
        einreichen(vorhanden, a.schreiben)


if __name__ == '__main__':
    try:
        main()
    except ApiFehler as e:
        sys.exit(f'FEHLER: {e}')
