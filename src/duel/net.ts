// Verbindung zum Duell-Server (worker/index.ts).

import { Capacitor } from '@capacitor/core';
import { DUEL_PROTOCOL, type ClientMsg, type DuelGame, type ServerMsg } from './protocol';
import { getIdentity } from './identity';

/** Feste Adresse: die native App läuft unter capacitor://localhost und braucht sie absolut. */
export const DUEL_HOST = 'https://mahjong.almaz6380.workers.dev';

/**
 * Basisadresse des Servers. Im Web dieselbe Herkunft (Live-Seite und
 * `wrangler dev` liefern App und Server zusammen aus), in der App und im
 * Vite-Entwicklungsserver die Live-Adresse. Für Tests überschreibbar per
 * `localStorage.duelServer`.
 */
export function serverBase(): string {
  try {
    const o = localStorage.getItem('duelServer');
    if (o) return o.replace(/\/$/, '');
  } catch {
    /* kein Speicher */
  }
  if (Capacitor.isNativePlatform()) return DUEL_HOST;
  const { protocol, origin, port, hostname } = window.location;
  // Kopie unter almaz6380.github.io/mahjong/spiel/ (für AdSense): dort gibt es keinen Duell-Server.
  if (hostname.endsWith('github.io')) return DUEL_HOST;
  if ((protocol === 'http:' || protocol === 'https:') && port !== '5173' && port !== '5199') return origin;
  return DUEL_HOST;
}

function wsBase(): string {
  return serverBase().replace(/^http/, 'ws');
}

export function inviteLink(code: string): string {
  return `${DUEL_HOST}/duell/${code}`;
}

export async function createRoom(game: DuelGame): Promise<string> {
  const r = await fetch(`${serverBase()}/api/duel/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
  });
  if (!r.ok) throw new Error('create ' + r.status);
  return ((await r.json()) as { code: string }).code;
}

/** Gibt es den Raum? `null` = Code unbekannt oder abgelaufen. Wirft bei Netzfehler. */
export async function roomInfo(code: string): Promise<{ game: DuelGame } | null> {
  const r = await fetch(`${serverBase()}/api/duel/room/${code}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('info ' + r.status);
  return (await r.json()) as { game: DuelGame };
}

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'failed';

/**
 * Hält die Verbindung zu einem Raum und baut sie bei Abbruch selbst wieder
 * auf. Der Server erkennt den Spieler an der ID wieder und schickt den Stand
 * neu — für den Spieler sieht ein Funkloch nur wie eine kurze Pause aus.
 */
export class DuelConnection {
  private ws: WebSocket | null = null;
  private closed = false;
  private tries = 0;
  private pingId: ReturnType<typeof setInterval> | null = null;
  private retryId: ReturnType<typeof setTimeout> | null = null;
  /** Serverzeit − Gerätezeit, damit der Countdown auf beiden Geräten gleich läuft. */
  offset = 0;

  constructor(
    readonly code: string,
    private onMsg: (m: ServerMsg) => void,
    private onStatus: (s: ConnStatus) => void,
  ) {}

  /** Jetzt in Serverzeit. */
  serverNow(): number {
    return Date.now() + this.offset;
  }

  start(): void {
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    this.onStatus(this.tries ? 'reconnecting' : 'connecting');
    const id = await getIdentity();
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase()}/api/duel/room/${this.code}`);
    } catch {
      return this.retry();
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', pid: id.pid, name: id.name, v: DUEL_PROTOCOL } satisfies ClientMsg));
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.t === 'joined') {
        this.tries = 0;
        this.offset = m.now - Date.now();
        this.onStatus('open');
        if (this.pingId) clearInterval(this.pingId);
        this.pingId = setInterval(() => this.send({ t: 'ping' }), 15000);
      }
      if (m.t === 'pong') this.offset = m.now - Date.now();
      if (m.t === 'error') {
        // Endgültig: Raum unbekannt, voll oder alte App-Version.
        this.closed = true;
        this.onStatus('failed');
      }
      this.onMsg(m);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.pingId) clearInterval(this.pingId);
      this.pingId = null;
      if (!this.closed) this.retry();
    };
  }

  private retry(): void {
    if (this.closed) return;
    this.tries++;
    this.onStatus('reconnecting');
    const ms = Math.min(5000, 500 * 2 ** Math.min(this.tries, 4));
    this.retryId = setTimeout(() => this.connect(), ms);
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Verbindung beenden. `leave` = laufendes Duell aufgeben. */
  close(leave = false): void {
    if (leave) this.send({ t: 'leave' });
    this.closed = true;
    if (this.retryId) clearTimeout(this.retryId);
    if (this.pingId) clearInterval(this.pingId);
    try {
      this.ws?.close(1000);
    } catch {
      /* egal */
    }
    this.ws = null;
  }
}

/**
 * Warteschlange für zufällige Gegner. Ruft `onMatched(code)` auf, sobald
 * jemand gefunden ist. Rückgabe: Abbrechen.
 */
export function joinQueue(game: DuelGame, onMatched: (code: string) => void, onFail: () => void): () => void {
  let done = false;
  let ws: WebSocket | null = null;
  (async () => {
    const id = await getIdentity();
    if (done) return;
    try {
      ws = new WebSocket(`${wsBase()}/api/duel/queue?game=${game}`);
    } catch {
      onFail();
      return;
    }
    ws.onopen = () => ws?.send(JSON.stringify({ t: 'hello', pid: id.pid }));
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data)) as { t: string; code?: string };
        if (m.t === 'matched' && m.code && !done) {
          done = true;
          onMatched(m.code);
        }
      } catch {
        /* egal */
      }
    };
    ws.onclose = () => {
      if (!done) {
        done = true;
        onFail();
      }
    };
  })();
  return () => {
    done = true;
    try {
      ws?.close(1000);
    } catch {
      /* egal */
    }
  };
}
