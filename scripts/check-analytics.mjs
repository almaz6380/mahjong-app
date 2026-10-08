// Prüft die Besucherzählung (Cloudflare Web Analytics, vorher Vercel) — vor allem die eine Regel,
// an der alles hängt: **in der nativen App darf sie NICHT laden.**
//
// Warum ein Skript und kein Blick in den Quelltext: Capacitor kopiert das
// gebaute Bundle unverändert nach ios/ und android/. Ob der Riegel wirklich
// hält, entscheidet sich also im FERTIGEN Bundle, nicht in src/. Genau dort
// misst dieses Skript — es lädt dist/ in einem echten Browser und zählt die
// Anfragen an das Zählskript (static.cloudflareinsights.com) — abgefangen,
// es geht also nichts ins Netz.
//
// Aufruf: npm run build && node scripts/check-analytics.mjs
//
// Zwei Kunstgriffe, ohne die der Test nichts aussagen würde:
// (1) Die native WebView erkennt Capacitor an `window.androidBridge` bzw.
//     `window.webkit.messageHandlers.bridge` — genau das setzt der Fall „nativ"
//     unten, damit `Capacitor.isNativePlatform()` im Bundle wirklich true meldet.
// (2) Gezählt wird bewusst nicht auf localhost (dev/preview soll still bleiben),
//     also braucht der Web-Fall einen anderen Hostnamen. Der kommt über Chromes
//     host-resolver-rules und zeigt auf denselben lokalen Server.
// Der Server ist bewusst ein eigener Dreizeiler statt `vite preview`: Vite
// blockt fremde Hostnamen (`Blocked request. This host is not allowed`) und
// würde damit ausgerechnet den Web-Fall unmöglich machen.

import { createServer } from 'node:http'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const HOST_ALIAS = 'mahjong.test'
const DIST = new URL('../dist/', import.meta.url).pathname

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ fehlt oder ist unvollständig — vorher `npm run build` laufen lassen.')
  process.exit(1)
}

// Browser suchen: $CHROME, sonst der von Playwright vorinstallierte (der Ordner
// trägt die Revisionsnummer, deshalb nicht fest verdrahten), sonst System-Chrome.
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  if (existsSync(root)) {
    for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium'))) {
      for (const bin of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = join(root, dir, bin)
        if (existsSync(p)) return p
      }
    }
  }
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(p)) return p
  }
  throw new Error('Kein Chromium gefunden — CHROME=<pfad> setzen.')
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  const file = join(DIST, path === '/' ? 'index.html' : path)
  if (!file.startsWith(DIST) || !existsSync(file)) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port

const browser = await chromium.launch({
  executablePath: findChrome(),
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`],
})

/** Lädt eine Seite und meldet, ob das Zählskript angefordert wurde. */
async function insightsRequested(url, { native = false } = {}) {
  const ctx = await browser.newContext()
  if (native) {
    // Was die Android-WebView von Capacitor in die Seite stellt. Dem Bundle
    // genügt das: getPlatform() → 'android', isNativePlatform() → true.
    await ctx.addInitScript(() => {
      window.androidBridge = { postMessage() {} }
    })
  }
  // Das Zählskript kommt von Cloudflare; hier genügt eine leere Antwort —
  // geprüft wird, DASS es angefordert wird, nicht was es tut.
  let hit = false
  await ctx.route('https://static.cloudflareinsights.com/**', (route) => {
    hit = true
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'load' }).catch(() => {})
  // Das Skript hängt sich mit `defer` bzw. nachträglich ein — kurz nachfassen.
  await page.waitForTimeout(1500)
  await ctx.close()
  return hit
}

const base = `http://${HOST_ALIAS}:${PORT}`
const cases = [
  ['Web, Spiel (index.html)', `${base}/`, {}, true],
  ['Web, Link-in-Bio (links.html)', `${base}/links.html`, {}, true],
  ['Web, Datenschutz', `${base}/privacy.html`, {}, true],
  ['Web, Impressum', `${base}/impressum.html`, {}, true],
  ['NATIV (Capacitor-WebView)', `${base}/`, { native: true }, false],
  ['localhost (dev/preview)', `http://localhost:${PORT}/`, {}, false],
]

let failed = 0
for (const [name, url, opts, expected] of cases) {
  const got = await insightsRequested(url, opts)
  const ok = got === expected
  if (!ok) failed++
  console.log(
    `${ok ? '✓' : '✗'} ${name}: soll ${expected ? 'zählen' : 'NICHT zählen'}, ` +
      `tut es ${got ? 'zählen' : 'nicht'}`,
  )
}

await browser.close()
server.close()

if (failed) {
  console.error(`\n${failed} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('\nAlles in Ordnung: gezählt wird nur im Web, nie in der nativen App.')
