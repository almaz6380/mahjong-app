// Findet den Browser fuer die Aufnahme.
//
// ⚠ Warum `playwright-core` und nicht `playwright`: Das volle Paket laedt bei
// JEDER Installation Chromium, Firefox und WebKit herunter (~150 MB, eigener
// postinstall-Schritt). Vercel installiert die devDependencies mit, bevor es
// baut — mit `playwright` in der package.json haengt also an jedem Deploy des
// Web-Bundles ein Browser-Download, der nichts mit dem Bundle zu tun hat.
// `playwright-core` bringt dieselbe API ohne Browser mit; den Pfad liefern wir
// selbst. Dasselbe Muster nutzt das Repo schon fuer `puppeteer-core`.

import { existsSync } from 'node:fs';

// Reihenfolge: ausdrueckliche Angabe schlaegt Fund. CHROME steht mit drin,
// weil der Smoke-Test des Repos diese Variable benutzt — zwei Namen fuer
// dieselbe Sache waeren eine Stolperfalle.
const KANDIDATEN = [
  process.env.CHROMIUM_PFAD,
  process.env.CHROME,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

export function browserPfad() {
  for (const p of KANDIDATEN) {
    if (p && existsSync(p)) return p;
  }
  throw new Error(
    'Kein Chrome/Chromium gefunden.\n' +
    'Setze CHROMIUM_PFAD auf die ausfuehrbare Datei, z. B.\n' +
    '  export CHROMIUM_PFAD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"\n' +
    'In der Cloud-Sitzung: export CHROMIUM_PFAD=/opt/pw-browsers/chromium',
  );
}
