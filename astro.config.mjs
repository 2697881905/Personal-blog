import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

const site = process.env.SITE_URL || process.env.URL;

export default defineConfig({
  site,
  output: 'static',
  integrations: [tailwind()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  markdown: {
    shikiConfig: {
      theme: 'vesper',
      wrap: true
    }
  }
});
