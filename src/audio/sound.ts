import { Capacitor } from '@capacitor/core';

// ===========================================================================
//  Sound (WebAudio-Synth, keine Audio-Dateien) + Haptik.
//  Umschaltbar über setSoundEnabled().
// ===========================================================================

let enabled = true;
export function setSoundEnabled(on: boolean) {
  enabled = on;
}

// Vibration getrennt schaltbar: Wer ohne Ton spielt, will oft trotzdem spüren,
// dass der Tipp angekommen ist — und umgekehrt.
let hapticsOn = true;
export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
}

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// `self` = false für Züge, die der Computer macht (4-Spieler/Riichi): Der Klang
// gehört dazu, aber das Handy soll nicht bei jedem KI-Abwurf brummen.
export function playTap(self = true) {
  tone(660, 0.06, 'sine', 0.12);
  if (self) haptic('tap');
}
export function playMatch() {
  tone(523.25, 0.09, 'sine', 0.16);
  tone(783.99, 0.14, 'sine', 0.16, 0.06);
  haptic('match');
}
export function playInvalid() {
  tone(150, 0.13, 'square', 0.1);
}
export function playWin() {
  // Windspiel: helle, lang ausklingende Glasklänge (pentatonisch)
  [1318.51, 1567.98, 1975.53, 2637.02, 2093.0].forEach((f, i) => {
    tone(f, 1.1, 'sine', 0.10, i * 0.14);
    tone(f * 2.76, 0.5, 'sine', 0.03, i * 0.14); // metallischer Oberton
  });
  haptic('win');
}

// Koto-Akzent beim Levelstart: kurze gezupfte Pentatonik (D–F–G–A).
export function playKoto() {
  [293.66, 349.23, 392.0, 440.0].forEach((f, i) => {
    tone(f, 0.5, 'triangle', 0.12, i * 0.12);
    tone(f * 2, 0.22, 'sine', 0.05, i * 0.12); // Anschlag-Brillanz
  });
}

// --- Haptik ----------------------------------------------------------------
// Nativ über den Taptic Engine / Vibrator (Capacitor), im Web über die
// Vibration-API. **iOS/Safari kennt navigator.vibrate NICHT** — in der Web-App
// auf dem iPhone bleibt es deshalb still; dort gibt es Haptik nur in der
// nativen App. Android vibriert in beiden Fällen (die VIBRATE-Berechtigung
// bringt das Haptics-Plugin über sein eigenes Manifest mit).
type Buzz = 'tap' | 'match' | 'win';
const WEB_PATTERN: Record<Buzz, number | number[]> = {
  tap: 8, // nur ein Tick — es wird sehr oft getippt
  match: 18,
  win: [14, 60, 22],
};

async function haptic(kind: Buzz) {
  if (!hapticsOn) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'win') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: kind === 'tap' ? ImpactStyle.Light : ImpactStyle.Medium });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(WEB_PATTERN[kind]);
  } catch {
    /* ignore */
  }
}
