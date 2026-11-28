import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { calloutPlugin, tableWrapperPlugin } from './src/lib/callouts.ts';

// Default to port 3000 while honoring PORT for the local visual harness.
const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  site: 'https://hech.dev',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  markdown: {
    processor: satteri({
      hastPlugins: [calloutPlugin, tableWrapperPlugin],
    }),
    shikiConfig: { theme: 'catppuccin-mocha' },
  },
  server: {
    host: '127.0.0.1',
    port,
  },
});
