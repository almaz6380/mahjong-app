// Externe Links. Kein Browser-Plugin installiert: window.open mit _blank öffnet
// in Capacitor den System-Browser (bzw. die Store-App), im Web einen neuen Tab.
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}
