import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Bun on sandboxed Linux filesystems throws ENOTDIR when fs.promises.rm receives
// a directory URL or path with a trailing slash (e.g. dist/.prerender/).
const rmPatched = Symbol.for('dev-journal.bun-fs-rm-patched');
if ('Bun' in globalThis && typeof fs.promises?.rm === 'function' && !(rmPatched in fs.promises)) {
  const originalRm = fs.promises.rm.bind(fs.promises);
  fs.promises.rm = (target, options) => {
    let normalized = target;
    if (target instanceof URL && target.protocol === 'file:') {
      normalized = fileURLToPath(target);
    }
    if (typeof normalized === 'string' && normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, '');
    }
    return originalRm(normalized, options);
  };
  Object.defineProperty(fs.promises, rmPatched, { value: true });
}

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
