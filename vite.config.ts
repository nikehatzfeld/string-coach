import { defineConfig } from 'vite';
import { alphaTab } from '@coderline/alphatab-vite';

export default defineConfig({
  // GitHub Pages sert l'app sous /string-coach/ ; en local et sur Vercel, à la racine.
  base: process.env.BASE_PATH ?? '/',
  plugins: [alphaTab()],
  server: { host: true },
});
