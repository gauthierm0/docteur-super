// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Site URL — update before deploying
  site: 'https://docteursuper.com',
  compressHTML: true,
  build: {
    assets: '_assets',
  },
});
