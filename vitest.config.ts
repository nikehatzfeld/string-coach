import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Certains tests parcourent toute la bibliothèque (plusieurs centaines de morceaux, deux instruments).
    testTimeout: 120000,
  },
});
