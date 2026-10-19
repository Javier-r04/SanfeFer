/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
