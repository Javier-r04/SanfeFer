/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // App instalable. El service worker solo guarda la app (HTML, JS, CSS, fuentes e íconos);
    // los datos siempre vienen de la API, nunca de una copia vieja.
    VitePWA({
      registerType: 'prompt', // en pleno turno no se recarga sola: el usuario decide cuándo actualizar
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'SanfeFer — Punto de venta',
        short_name: 'SanfeFer',
        description: 'Punto de venta, inventario y reportes de SanfeFer',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f0e6',
        theme_color: '#3f7360',
        categories: ['business', 'food'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Mesas', url: '/pos', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Barra', url: '/pos/barra', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true, // accesible desde el celular en la misma red: http://<ip-de-tu-pc>:5173
    proxy: {
      // Mismo origen en desarrollo: la cookie de sesión funciona sin CORS.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          data: [
            '@tanstack/react-query',
            'zod',
            'react-hook-form',
            '@hookform/resolvers',
            'zustand',
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
