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
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.1));
  haptic('medium');
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
