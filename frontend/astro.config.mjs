// @ts-check
import { defineConfig  } from 'astro/config';
import aws from 'astro-sst'

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: aws(),
  integrations: [react()],
  output: 'server',
});