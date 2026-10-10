import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Name of the GitHub repository (the site lives at https://<user>.github.io/<REPO>/).
// If you rename the repo, change it here — it is used for the app's scope and start page too.
const BASE = '/ikhtabir-hifzak/';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // new versions install themselves and the page reloads once, so phones never stay on an old copy
      registerType: 'autoUpdate',
      injectRegister: false, // registered from src/main.jsx
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'اختبر حفظك - إكمال الآيات والتسميع',
        short_name: 'اختبر حفظك',
        description: 'تدرّب على إكمال الآيات بحسب الجزء أو السورة أو الحزب أو الربع أو الوجه، مع تسميع صوتي.',
        lang: 'ar',
        dir: 'rtl',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ece6f9',
        theme_color: '#a892ee',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the whole app (including the Quran text, ~1.7 MB) is cached, so it also works offline
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // a new version takes over immediately instead of waiting for every window to be closed
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  base: BASE,
});
