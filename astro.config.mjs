import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// AI Studio's reverse proxy exposes only port 3000. Keep 3000 as the default
// while honoring PORT for the local visual harness and other hosted runtimes.
// Bind to all interfaces and relax Vite's host check only when PORT is present;
// local development stays loopback-only.
const hosted = Boolean(process.env.PORT);

export default defineConfig({
  site: 'https://hech.dev',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'catppuccin-mocha' },
  },
  server: {
    host: hosted ? true : '127.0.0.1',
    port: Number(process.env.PORT ?? 3000),
    ...(hosted ? { allowedHosts: true } : {}),
  },
});
