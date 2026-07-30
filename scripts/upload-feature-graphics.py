#!/usr/bin/env python3
"""Play-Feature-Grafiken je Sprache hochladen (1024×500).

Warum je Sprache: Play zeigt Nutzern ohne eigene Sprachfassung die Grafik der
Standardsprache — solange nur die deutsche existierte, stand „4 Spieler" auch
im japanischen und brasilianischen Eintrag.

Store-Einträge sind vom App-Build entkoppelt: Der Commit dieser Edit
veröffentlicht NUR Bilder, kein neues AAB, und löst keine Prüfung aus.

Bilder erzeugen:  node scripts/render-feature-graphic.mjs
Aufruf:           python3 scripts/upload-feature-graphics.py
"""
import importlib.util
import os
import sys
import urllib.request

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
BILDER = os.path.join(SCRIPTS, '..', 'store', 'feature-graphics')

spec = importlib.util.spec_from_file_location('pu', os.path.join(SCRIPTS, 'play-upload.py'))
pu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pu)

tok = pu.token()
base = f'{pu.API}/applications/{pu.PKG}/edits'
upload = f'{pu.UPLOAD}/applications/{pu.PKG}/edits'

eid = pu.call(tok, 'POST', base, data={})['id']
print(f'Edit {eid} geöffnet')
try:
    langs = [l['language'] for l in pu.call(tok, 'GET', f'{base}/{eid}/listings').get('listings', [])]
    print(f'Sprachfassungen im Store: {", ".join(langs)}')
    hochgeladen = 0
    for lang in langs:
        pfad = os.path.join(BILDER, f'feature-{lang}.png')
        if not os.path.exists(pfad):
            print(f'  [{lang}] KEIN BILD ({os.path.basename(pfad)}) — übersprungen')
            continue
        roh = open(pfad, 'rb').read()
        req = urllib.request.Request(
            f'{upload}/{eid}/listings/{lang}/featureGraphic?uploadType=media',
            data=roh, method='POST')
        req.add_header('Authorization', f'Bearer {tok}')
        req.add_header('Content-Type', 'image/png')
        with urllib.request.urlopen(req) as r:
            r.read()
        print(f'  [{lang}] hochgeladen ({len(roh) // 1024} kB)')
        hochgeladen += 1
    if not hochgeladen:
        print('Nichts hochgeladen — Edit wird verworfen.')
        pu.call(tok, 'DELETE', f'{base}/{eid}')
        sys.exit(1)
    pu.call(tok, 'POST', f'{base}/{eid}:validate')
    print('validiert')
    pu.call(tok, 'POST', f'{base}/{eid}:commit')
    print(f'✅ committet — {hochgeladen} Feature-Grafiken sind live')
except Exception as e:
    print(f'FEHLER: {e}')
    try:
        pu.call(tok, 'DELETE', f'{base}/{eid}')
        print('(Edit verworfen, nichts veröffentlicht)')
    except Exception:
        pass
    raise SystemExit(1)
