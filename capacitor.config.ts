import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // TODO: Vor der Store-Veröffentlichung eine eigene, eindeutige App-ID setzen
  // (Reverse-Domain, z. B. 'at.deinedomain.mahjong').
  appId: 'com.mahjong.master',
  appName: 'Mahjong',
  webDir: 'dist',
  backgroundColor: '#0b3d2e',
};

export default config;
