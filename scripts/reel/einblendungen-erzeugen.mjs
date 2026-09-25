// Mahjong-Einblendungen (Josef, 25.09.2026: „neu bauen"). Vier Standbilder, flux-pro ultra, je 0,06 $.
//
//   cd scripts/reel/assets/einblendungen && FAL_KEY=… node ../../einblendungen-erzeugen.mjs [junge|opa|tempel|steine]
//
// Danach auf 1080 px Breite bringen (siehe HERKUNFT.md). Kostet Geld — nur auf Zuruf.
import { writeFileSync } from 'node:fs';
const H = { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
const STIL = 'traditional Chinese ink wash painting (sumi-e) with soft watercolor, misty jade-green and deep teal palette '
  + 'with warm golden accents, gentle paper texture, calm and poetic mood, painterly brush strokes, '
  + 'no text, no letters, no calligraphy, no signature, no seal stamps, no watermark, no frame';
export const PROMPTS = {
  junge: 'vertical composition, a cheerful little boy about seven years old with short black hair and a simple red cotton jacket, '
    + 'sitting at a low wooden table, holding up one ivory mahjong tile with both hands and smiling with delight, '
    + 'a few ivory mahjong tiles on the table, plain misty background with empty sky, the whole upper area is empty mist, ' + STIL,
  opa: 'vertical composition, a kind elderly grandfather with a short white beard and a dark green robe, '
    + 'sitting at a low wooden table with mahjong tiles, smiling warmly and gently, one hand resting on a tile, '
    + 'soft lantern glow, pine branch in the background, ' + STIL,
  tempel: 'vertical composition, seen from behind, a small boy in a simple red cotton jacket climbing a long winding stone stairway '
    + 'up a misty mountain toward a tall pagoda temple on a cliff, pine trees on the rocks, the boy is small in the frame, '
    + 'drifting mist, ' + STIL,
  steine: 'vertical composition, close view of ivory mahjong tiles arranged in a small stack on a dark wooden table, '
    + 'soft lantern light, a pine sprig beside them, shallow depth of field, the tile faces are blurred and unreadable, ' + STIL,
};
const SEEDS = { junge: 8103, opa: 8201, tempel: 8301, steine: 8401 };
async function fal(eingabe) {
  const j = await (await fetch('https://queue.fal.run/fal-ai/flux-pro/v1.1-ultra', { method: 'POST', headers: H, body: JSON.stringify(eingabe) })).json();
  if (!j.status_url) throw new Error(JSON.stringify(j).slice(0, 300));
  for (;;) {
    await new Promise((x) => setTimeout(x, 2000));
    const s = await (await fetch(j.status_url, { headers: H })).json();
    if (s.status === 'COMPLETED') break;
    if (!['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(JSON.stringify(s));
  }
  return (await fetch(j.response_url, { headers: H })).json();
}
const NUR = process.argv.slice(2);
const erg = await Promise.allSettled(Object.entries(PROMPTS).filter(([k]) => !NUR.length || NUR.includes(k)).map(async ([k, prompt]) => {
  const o = await fal({ prompt, aspect_ratio: '9:16', seed: SEEDS[k], output_format: 'jpeg', safety_tolerance: '2' });
  const url = o.images?.[0]?.url; if (!url) throw new Error(`${k}: ${JSON.stringify(o).slice(0, 300)}`);
  writeFileSync(`${k}.jpg`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`✓ ${k}.jpg  Seed ${SEEDS[k]}`);
}));
erg.filter((x) => x.status === 'rejected').forEach((x) => console.log('✗', x.reason.message));
