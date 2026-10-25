// File: astro.config.mjs

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
    platformProxy: {
      enabled: true,
    },
  }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      target: 'webworker',
      noExternal: true,
    },
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare'],
    },
  },
});