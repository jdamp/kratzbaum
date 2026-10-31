import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  build: { outDir: '../cmd/kratzbaum/web/dist', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      registerType: 'prompt',
      manifest: {
        id: '/',
        lang: 'de',
        name: 'kratzbaum · deine Pflanzensammlung',
        short_name: 'kratzbaum',
        description: 'Ein entspannter Weg, deine Pflanzen zu pflegen.',
        theme_color: '#f6f5ef',
        background_color: '#f6f5ef',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
