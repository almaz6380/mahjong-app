// Versionsanzeige in den Einstellungen.
//
// Die Nummer kommt vom NATIVEN Paket (`App.getInfo()`), nicht aus einer
// Konstante im Web-Code: Sonst müsste sie bei jedem Release an einer vierten
// Stelle nachgezogen werden (neben pbxproj, build.gradle und den Store-Texten)
// — und genau das ist schiefgegangen. Bis 10.8.2026 stand in den Einstellungen
// fest verdrahtet „v1.0", während im Store längst 1.0.4 lief.
//
// Im Web gibt es kein natives Paket; dort steht schlicht „Web".
import { Capacitor } from '@capacitor/core';

export async function appVersionLabel(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Web';
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    // version = 1.0.4 (Marketing), build = 19 (fortlaufend) — die Build-Nummer
    // ist bei Fehlermeldungen aus dem Store das Entscheidende.
    return info.build ? `v${info.version} (${info.build})` : `v${info.version}`;
  } catch {
    return '';
  }
}
