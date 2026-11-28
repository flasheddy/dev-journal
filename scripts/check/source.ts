import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { buildTagMap, loadPosts, loadProjects, type Reporter } from './content';
import { assertContains, assertFile, readText, rel, walk } from './files';
import { checkSecrets } from './secrets';
import { checkTrackedArtifacts } from './tracked';

export function checkSource(root: string, fail: Reporter): { posts: number; tags: number } {
  const required = [
    'AGENTS.md',
    'README.md',
    'astro.config.mjs',
    'package.json',
    'tsconfig.json',
    'src/content.config.ts',
    'src/layouts/BaseLayout.astro',
    'src/pages/og/[...slug].png.ts',
    'src/pages/rss.xml.ts',
    'src/pages/search-index.json.ts',
    'src/pages/ai-corpus.json.ts',
    'src/pages/index.astro',
    'src/pages/blog/index.astro',
    'src/pages/blog/[...slug].astro',
    'src/pages/tags/index.astro',
    'src/pages/tags/[tag].astro',
    'src/styles/site.css',
    'src/scripts/main.ts',
    'src/scripts/features/ask-journal.ts',
    'src/scripts/features/command-palette.ts',
    'src/scripts/features/global-keyboard.ts',
    'src/scripts/features/theme.ts',
    'src/scripts/features/content-enhancements.ts',
    'src/scripts/features/filters.ts',
    'src/scripts/features/reading-progress.ts',
    'src/scripts/features/toc.ts',
    'public/CNAME',
    'public/robots.txt',
    '.github/workflows/deploy.yml',
  ];
  required.forEach((file) => assertFile(root, file, fail));

  for (const legacy of [
    'config.toml',
    'verify.fish',
    'verify-visual.fish',
    'templates',
    'static',
    'content',
  ]) {
    if (existsSync(join(root, legacy))) fail(`legacy static-site path still present: ${legacy}`);
  }

  assertContains(root, 'astro.config.mjs', "site: 'https://hech.dev'", fail);
  assertContains(root, 'astro.config.mjs', "theme: 'catppuccin-mocha'", fail);
  assertContains(root, 'astro.config.mjs', 'process.env.PORT ?? 3000', fail);
  assertContains(root, '.github/workflows/deploy.yml', 'actions/configure-pages@v5', fail);
  assertContains(root, '.github/workflows/deploy.yml', 'actions/upload-pages-artifact@v3', fail);
  assertContains(root, '.github/workflows/deploy.yml', 'actions/deploy-pages@v4', fail);
  assertContains(root, 'src/styles/site.css', 'background: #181825;', fail);
  assertContains(root, 'src/styles/site.css', 'border-radius: 8px;', fail);
  assertContains(root, 'src/styles/site.css', '.post-item__meta', fail);
  assertContains(
    root,
    'src/scripts/features/theme.ts',
    "const storageKey = 'dev-journal-theme';",
    fail,
  );
  assertContains(
    root,
    'src/scripts/features/content-enhancements.ts',
    'navigator.clipboard.writeText',
    fail,
  );

  const pkg = JSON.parse(readText(root, 'package.json')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  for (const script of ['dev', 'build', 'check', 'check:built']) {
    if (!pkg.scripts?.[script]) fail(`package.json is missing the "${script}" script`);
  }
  for (const dependency of ['satori', '@resvg/resvg-js']) {
    if (!pkg.dependencies?.[dependency]) {
      fail(`package.json is missing the "${dependency}" dependency`);
    }
  }

  checkTrackedArtifacts(root, fail);

  const posts = loadPosts(
    walk(root, 'src/content/blog', (path) => extname(path) === '.md'),
    fail,
    (path) => rel(root, path),
  );
  loadProjects(
    walk(root, 'src/content/projects', (path) => extname(path) === '.md'),
    fail,
    (path) => rel(root, path),
  );
  const tags = buildTagMap(posts, fail);

  const pinned = posts.find((post) => post.slug === 'offline-visual-verification');
  if (!pinned) {
    fail('contract-pinned post is missing: src/content/blog/offline-visual-verification.md');
  } else {
    if (pinned.title !== 'Offline-First Visual Verification: A Decoupled Playwright Harness') {
      fail('contract-pinned post title changed');
    }
    const pinnedTags = ['Playwright', 'Bun', 'CSS', 'Astro'];
    if (JSON.stringify(pinned.tags) !== JSON.stringify(pinnedTags)) {
      fail('contract-pinned post tags changed');
    }
  }

  const routes = new Set<string>(['/', '/blog/', '/tags/']);
  for (const post of posts) routes.add(`/blog/${post.slug}/`);
  for (const slug of tags.keys()) routes.add(`/tags/${slug}/`);

  for (const post of posts) {
    for (const match of post.body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1];
      if (/^(?:[a-z]+:|\/\/|#)/i.test(target)) continue;
      if (target.startsWith('@/')) {
        fail(`${post.file}: legacy @/ link remains: ${target}`);
        continue;
      }
      if (target.startsWith('/')) {
        const path = target.split(/[?#]/)[0];
        if (!routes.has(path)) fail(`${post.file}: internal link has no route: ${target}`);
      }
    }
  }

  for (const file of walk(root, 'src', (path) => extname(path) === '.astro')) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const target = match[1];
      if (target.startsWith('//') || target.includes('{')) continue;
      const path = target.split(/[?#]/)[0];
      if (path === '/' || routes.has(path)) continue;
      if (path.startsWith('/_astro') || path === '/CNAME' || path === '/robots.txt') continue;
      if (path === '/rss.xml') continue;
      fail(`${rel(root, file)}: internal asset or link has no known target: ${target}`);
    }
  }

  checkSecrets(root, fail);

  return { posts: posts.length, tags: tags.size };
}
