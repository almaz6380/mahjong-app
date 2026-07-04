import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' ist wichtig, damit die App im Capacitor-WebView (file://) lädt.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  server: { host: true },
})
