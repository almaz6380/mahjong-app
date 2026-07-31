// Global gemountete Kurzmeldung. Jeder Bildschirm ruft showToast(text) auf —
// vor allem für Rückmeldungen zu belohnten Videos: ohne sie lief jeder
// Fehlschlag (kein Video verfügbar, Video abgebrochen) stumm ins Leere und es
// sah aus, als hätte die App die Belohnung verschluckt.

import { useSyncExternalStore } from 'react';

const HIDE_AFTER_MS = 3000;

let current: { text: string; id: number } | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string) {
  if (timer) clearTimeout(timer);
  // Neue id auch bei gleichem Text: sonst spielt React die Animation nicht neu.
  current = { text, id: nextId++ };
  emit();
  timer = setTimeout(() => {
    timer = null;
    current = null;
    emit();
  }, HIDE_AFTER_MS);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => current;

export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!toast) return null;
  return (
    <div className="toast" key={toast.id} role="status">
      {toast.text}
    </div>
  );
}
