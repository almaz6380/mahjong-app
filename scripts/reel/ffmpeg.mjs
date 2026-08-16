// ffmpeg-Helfer, gemeinsam fuer make-reel.mjs und spot.mjs.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const FFMPEG = require('ffmpeg-static');

export const lauf = (args) => new Promise((res, rej) => {
  const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.slice(-1500)))));
});

// Laenge messen — ffprobe liegt diesem Container nicht bei, es gibt nur
// ffmpeg-static. ⚠ `lauf()` taugt dafuer NICHT: ffmpeg beendet sich hier mit
// Code 1, weil kein Ausgabeziel angegeben ist, und `lauf` wuerde das als
// Fehler werfen.
export const dauerVon = (datei) => new Promise((res) => {
  const p = spawn(FFMPEG, ['-hide_banner', '-i', datei]);
  let e = ''; p.stderr.on('data', (d) => { e += d; });
  p.on('close', () => {
    const m = e.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    res(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
  });
});
