import { Capacitor } from '@capacitor/core';

// ===========================================================================
//  Sound (WebAudio-Synth, keine Audio-Dateien) + Haptik.
//  Umschaltbar über setSoundEnabled().
// ===========================================================================

let enabled = true;
export function setSoundEnabled(on: boolean) {
  enabled = on;
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

export function playTap() {
  tone(660, 0.06, 'sine', 0.12);
}
export function playMatch() {
  tone(523.25, 0.09, 'sine', 0.16);
  tone(783.99, 0.14, 'sine', 0.16, 0.06);
  haptic('light');
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
  haptic('medium');
}

// Koto-Akzent beim Levelstart: kurze gezupfte Pentatonik (D–F–G–A).
export function playKoto() {
  [293.66, 349.23, 392.0, 440.0].forEach((f, i) => {
    tone(f, 0.5, 'triangle', 0.12, i * 0.12);
    tone(f * 2, 0.22, 'sine', 0.05, i * 0.12); // Anschlag-Brillanz
  });
}

// --- Haptik (nur nativ) ----------------------------------------------------
async function haptic(style: 'light' | 'medium') {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch {
    /* ignore */
  }
}
