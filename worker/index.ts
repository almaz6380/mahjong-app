// Duell-Server (Cloudflare Worker + Durable Objects).
//
// Der Worker beantwortet nur /api/duel/* (siehe `run_worker_first` in
// wrangler.jsonc); alles andere liefert Cloudflare weiter direkt aus dist/.
//
//   POST /api/duel/create {game}      → {code}   neuer Raum für „Freund einladen"
//   GET  /api/duel/room/<CODE>  (WS)  → Raum betreten (Code eingeben / Link)
//   GET  /api/duel/queue?game=… (WS)  → Warteschlange „Zufälliger Gegner"
//
// Jeder Raum ist ein eigenes Durable Object (DuelRoom), benannt nach dem Code.
// Die Warteschlange ist ein einziges Durable Object (DuelLobby).

import { DurableObject } from 'cloudflare:workers';
import { CODE_ALPHABET, CODE_LEN, normalizeCode, type DuelGame, type ServerMsg } from '../src/duel/protocol';
import { Room } from './logic/room';
import type { RoomIO } from './logic/io';

export interface Env {
  DUEL_ROOM: DurableObjectNamespace<DuelRoom>;
  DUEL_LOBBY: DurableObjectNamespace<DuelLobby>;
  ANDROID_CERT_SHA256?: string;
}

const IOS_APP_ID = 'JU8STVD4SJ.com.mahjongroyale.app';
const ANDROID_PACKAGE = 'com.mahjongroyale.app';

/** Ein Raum, in dem nie gespielt wurde, verfällt nach dieser Zeit. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function isGame(g: unknown): g is DuelGame {
  return g === 'solitaire' || g === 'riichi';
}

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

/** Legt einen Raum an. Kollidiert der Code (sehr selten), wird neu gewürfelt. */
async function createRoom(env: Env, game: DuelGame): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const stub = env.DUEL_ROOM.get(env.DUEL_ROOM.idFromName(code));
    if (await stub.init(game, code)) return code;
  }
  throw new Error('kein freier Code');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Einladungslink im Browser: auf die Startseite mit ?duell=CODE. Unter
    // /duell/ fände die App ihre Dateien nicht (relative Pfade, base './').
    const invite = path.match(/^\/duell\/([A-Za-z0-9]+)\/?$/);
    if (invite) {
      const code = normalizeCode(invite[1]);
      return Response.redirect(`${url.origin}/${code ? `?duell=${code}` : ''}`, 302);
    }

    // Apple: Universal Links für /duell/*. Muss als JSON ohne Umleitung kommen.
    if (path === '/.well-known/apple-app-site-association' || path === '/apple-app-site-association') {
      return new Response(
        JSON.stringify({ applinks: { details: [{ appIDs: [IOS_APP_ID], components: [{ '/': '/duell/*' }] }] } }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Android: App Links. Ohne Fingerabdruck eine leere Liste — dann öffnet der
    // Link schlicht die Web-Fassung.
    if (path === '/.well-known/assetlinks.json') {
      const prints = (env.ANDROID_CERT_SHA256 ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const body = prints.length
        ? [{
            relation: ['delegate_permission/common.handle_all_urls'],
            target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: prints },
          }]
        : [];
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }

    if (!path.startsWith('/api/duel/')) return new Response('Not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (path === '/api/duel/create' && req.method === 'POST') {
      let game: unknown = 'solitaire';
      try {
        game = ((await req.json()) as { game?: unknown }).game;
      } catch {
        /* leerer Body = Solitaire */
      }
      if (!isGame(game)) return json({ error: 'bad' }, 400);
      return json({ code: await createRoom(env, game) });
    }

    const roomMatch = path.match(/^\/api\/duel\/room\/([A-Za-z0-9]+)$/);
    if (roomMatch) {
      const code = normalizeCode(roomMatch[1]);
      if (!code) return json({ error: 'notfound' }, 404);
      if (req.headers.get('Upgrade') !== 'websocket') {
        // Ohne WebSocket: nur nachsehen, ob es den Raum gibt (für die Code-Eingabe).
        const stub = env.DUEL_ROOM.get(env.DUEL_ROOM.idFromName(code));
        const info = await stub.info();
        return info ? json(info) : json({ error: 'notfound' }, 404);
      }
      return env.DUEL_ROOM.get(env.DUEL_ROOM.idFromName(code)).fetch(req);
    }

    if (path === '/api/duel/queue') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'bad' }, 426);
      const game = url.searchParams.get('game');
      if (!isGame(game)) return json({ error: 'bad' }, 400);
      return env.DUEL_LOBBY.get(env.DUEL_LOBBY.idFromName('lobby')).fetch(req);
    }

    return json({ error: 'notfound' }, 404);
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------

interface RoomMeta {
  game: DuelGame;
  code: string;
  created: number;
}

export class DuelRoom extends DurableObject<Env> {
  private meta: RoomMeta | null | undefined;
  private room: Room | null = null;
  private sockets: (WebSocket | null)[] = [null, null];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  private async loadMeta(): Promise<RoomMeta | null> {
    if (this.meta === undefined) this.meta = (await this.ctx.storage.get<RoomMeta>('meta')) ?? null;
    return this.meta;
  }

  /** Neuer Raum. `false`, wenn der Code schon vergeben ist. */
  async init(game: DuelGame, code: string): Promise<boolean> {
    const meta = await this.loadMeta();
    if (meta && Date.now() - meta.created < ROOM_TTL_MS) return false;
    this.meta = { game, code, created: Date.now() };
    await this.ctx.storage.put('meta', this.meta);
    // Nach Ablauf wirklich löschen, nicht nur ungültig machen (Datenschutzerklärung 6b).
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    this.room = null;
    return true;
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.meta = null;
  }

  async info(): Promise<{ game: DuelGame } | null> {
    const meta = await this.loadMeta();
    if (!meta) return null;
    if (!this.room && Date.now() - meta.created > ROOM_TTL_MS) return null;
    return { game: meta.game };
  }

  private getRoom(meta: RoomMeta): Room {
    if (this.room) return this.room;
    const io: RoomIO = {
      send: (slot, msg) => this.send(this.sockets[slot], msg),
      now: () => Date.now(),
      random: () => Math.random(),
      setTimer: (name, ms, fn) => {
        const old = this.timers.get(name);
        if (old) clearTimeout(old);
        this.timers.set(
          name,
          setTimeout(() => {
            this.timers.delete(name);
            fn();
          }, ms),
        );
      },
      clearTimer: (name) => {
        const old = this.timers.get(name);
        if (old) clearTimeout(old);
        this.timers.delete(name);
      },
    };
    this.room = new Room(meta.game, meta.code, io);
    return this.room;
  }

  private send(ws: WebSocket | null, msg: ServerMsg): void {
    if (!ws) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* Verbindung schon zu */
    }
  }

  async fetch(req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const meta = await this.info();
    const fullMeta = await this.loadMeta();
    if (!meta || !fullMeta) {
      this.send(server, { t: 'error', code: 'notfound' });
      server.close(4004, 'notfound');
      return new Response(null, { status: 101, webSocket: client });
    }
    const room = this.getRoom(fullMeta);
    let slot = -1;

    server.addEventListener('message', (ev) => {
      let msg: { t?: string; pid?: string; name?: string; v?: number };
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (slot < 0) {
        if (msg.t !== 'hello') return;
        const res = room.claim(String(msg.pid), Number(msg.v));
        if ('error' in res) {
          this.send(server, { t: 'error', code: res.error });
          server.close(4000, res.error);
          return;
        }
        // Derselbe Spieler auf neuer Verbindung (App neu gestartet, Netz
        // gewechselt): alte Verbindung schließen, neue eintragen, DANN beitreten.
        const old = this.sockets[res.slot];
        slot = res.slot;
        this.sockets[slot] = server;
        if (old && old !== server) {
          try {
            old.close(4001, 'replaced');
          } catch {
            /* egal */
          }
        }
        room.join(slot, String(msg.pid), String(msg.name ?? ''));
        return;
      }
      room.onMsg(slot, msg);
    });

    const gone = () => {
      if (slot >= 0 && this.sockets[slot] === server) {
        this.sockets[slot] = null;
        room.disconnect(slot);
      }
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);

    return new Response(null, { status: 101, webSocket: client });
  }
}

// ---------------------------------------------------------------------------

interface Waiting {
  ws: WebSocket;
  pid: string;
}

/** Warteschlange für zufällige Gegner — je Spiel höchstens ein Wartender. */
export class DuelLobby extends DurableObject<Env> {
  private waiting = new Map<DuelGame, Waiting>();

  async fetch(req: Request): Promise<Response> {
    const game = new URL(req.url).searchParams.get('game') as DuelGame;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    let me: Waiting | null = null;

    server.addEventListener('message', async (ev) => {
      if (me) return;
      let msg: { t?: string; pid?: string };
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (msg.t !== 'hello' || typeof msg.pid !== 'string') return;
      me = { ws: server, pid: msg.pid };
      const other = this.waiting.get(game);
      if (other && other.pid !== me.pid && other.ws.readyState === WebSocket.READY_STATE_OPEN) {
        this.waiting.delete(game);
        try {
          const code = await createRoom(this.env, game);
          for (const w of [other, me]) {
            w.ws.send(JSON.stringify({ t: 'matched', code }));
            w.ws.close(1000, 'matched');
          }
        } catch {
          for (const w of [other, me]) w.ws.close(1011, 'error');
        }
        return;
      }
      this.waiting.set(game, me);
      server.send(JSON.stringify({ t: 'waiting' }));
    });

    const gone = () => {
      if (me && this.waiting.get(game) === me) this.waiting.delete(game);
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
