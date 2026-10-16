#!/usr/bin/env python3
"""Erste In-App-Käufe zusammen mit der App-Version einreichen (per API).

Apple will die ERSTEN Käufe einer App im selben Prüfpaket wie eine App-Version
(409 FIRST_CONSUMABLE_MUST_BE_SUBMITTED_ON_VERSION). Laut Doku geht das nur über
die Website; dieses Skript versucht den API-Weg über reviewSubmissionItems mit
der Beziehung `inAppPurchaseVersion` in DIE Einreichung, die die App-Version trägt.

  python3 scripts/asc-iap-mit-version.py              # nur ansehen
  python3 scripts/asc-iap-mit-version.py --schreiben  # umhängen + einreichen

Schritte mit --schreiben:
  1. Käufe aus fremden Entwürfen (nur Käufe, keine Version) lösen
  2. je Kauf eine bearbeitbare inAppPurchaseVersion holen oder anlegen
  3. diese als Einträge an die Einreichung mit der App-Version hängen
  4. offene Einträge als gelöst markieren und die Einreichung abschicken
"""
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('asc', os.path.join(HIER, 'asc-status.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
TOK = asc.token()
SCHREIBEN = '--schreiben' in sys.argv


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
        raise ApiFehler(f'HTTP {e.code} bei {methode} {pfad}: {e.read().decode(errors="replace")[:2500]}') from None


def items(sub_id):
    a = call('GET', f'/v1/reviewSubmissions/{sub_id}/items?limit=50'
                    '&include=appStoreVersion,inAppPurchaseVersion,appCustomProductPageVersion')
    out = []
    for it in a.get('data', []):
        rel = it.get('relationships') or {}
        art = [k for k, v in rel.items() if isinstance(v, dict) and v.get('data')]
        out.append((it, art))
    return out


subs = call('GET', f'/v1/reviewSubmissions?filter[app]={asc.APP_ID}&limit=20'
                   '&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES,WAITING_FOR_REVIEW,IN_REVIEW')['data']
mit_version, nur_kaeufe = None, []
for s in subs:
    st = s['attributes'].get('state')
    its = items(s['id'])
    arten = sorted({a for _, art in its for a in art})
    print(f"Einreichung {s['id']}  {st}  eingereicht={s['attributes'].get('submittedDate')}  Einträge={len(its)} {arten}")
    for it, art in its:
        print(f"   {it['id'][:24]}…  {it['attributes'].get('state')}  {art}")
    if 'appStoreVersion' in arten:
        mit_version = s
    elif arten and set(arten) <= {'inAppPurchaseVersion', 'reviewSubmission'}:
        nur_kaeufe.append((s, its))

iaps = call('GET', f'/v1/apps/{asc.APP_ID}/inAppPurchasesV2?limit=50')['data']
kauf_versionen = {}
for p in iaps:
    pid = p['attributes']['productId']
    try:
        vs = call('GET', f"/v2/inAppPurchases/{p['id']}/inAppPurchaseVersions?limit=10")['data']
    except ApiFehler as e:
        vs = []
        print(f'{pid}: Versionen nicht lesbar: {str(e)[:200]}')
    print(f"{pid}: Zustand={p['attributes'].get('state')}  Versionen=" +
          ', '.join(f"{v['id'][:10]}…:{v['attributes'].get('state')}" for v in vs))
    kauf_versionen[pid] = (p, vs)

if not mit_version:
    sys.exit('Keine Einreichung mit App-Version gefunden — nichts geändert.')
print(f"\nZiel: Einreichung {mit_version['id']} (mit App-Version)")
if not SCHREIBEN:
    print('TROCKENLAUF — nichts geändert.')
    sys.exit(0)

# 1. Käufe aus dem Nur-Käufe-Entwurf lösen
for s, its in nur_kaeufe:
    if s['attributes'].get('submittedDate'):
        print(f"Nur-Käufe-Einreichung {s['id']} ist schon abgeschickt — wird nicht angefasst")
        continue
    for it, _ in its:
        call('DELETE', f"/v1/reviewSubmissionItems/{it['id']}")
    print(f"Entwurf {s['id']}: {len(its)} Einträge gelöst")

# 2.+3. je Kauf eine bearbeitbare Version an die Einreichung hängen
schon = {((it.get('relationships') or {}).get('inAppPurchaseVersion') or {}).get('data', {}) .get('id')
         for it, _ in items(mit_version['id'])}
for pid, (p, vs) in kauf_versionen.items():
    v = next((v for v in vs if v['attributes'].get('state') in ('PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW')), None)
    if not v:
        v = call('POST', '/v1/inAppPurchaseVersions', {'data': {
            'type': 'inAppPurchaseVersions',
            'relationships': {'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': p['id']}}}}})['data']
        print(f'{pid}: Version angelegt {v["id"]}')
    if v['id'] in schon:
        print(f'{pid}: hängt schon an der Einreichung')
        continue
    call('POST', '/v1/reviewSubmissionItems', {'data': {
        'type': 'reviewSubmissionItems', 'relationships': {
            'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': mit_version['id']}},
            'inAppPurchaseVersion': {'data': {'type': 'inAppPurchaseVersions', 'id': v['id']}}}}})
    print(f'{pid}: an die Einreichung gehängt')

# 4. offene Einträge als gelöst markieren, dann abschicken
for it, art in items(mit_version['id']):
    if it['attributes'].get('state') in ('REJECTED', 'UNRESOLVED_ISSUES'):
        try:
            call('PATCH', f"/v1/reviewSubmissionItems/{it['id']}", {'data': {
                'type': 'reviewSubmissionItems', 'id': it['id'], 'attributes': {'resolved': True}}})
            print(f"Eintrag {art} als gelöst markiert")
        except ApiFehler as e:
            print(f'⚠ resolved: {str(e)[:300]}')
call('PATCH', f"/v1/reviewSubmissions/{mit_version['id']}", {'data': {
    'type': 'reviewSubmissions', 'id': mit_version['id'], 'attributes': {'submitted': True}}})
print(f"✅ Einreichung {mit_version['id']} abgeschickt (Version + Käufe)")
