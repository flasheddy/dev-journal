import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const builtMode = args.has('--built');

const errors: string[] = [];
const fail = (message: string) => errors.push(message);
const rel = (path: string) => relative(root, path).split('\\').join('/');

type RecordValue = Record<string, unknown>;

type BlogRecord = {
  file: string;
  slug: string;
  title: string;
  date: Date;
  updated?: Date;
  draft: boolean;
  description: string;
  tags: string[];
  body: string;
};

type ProjectRecord = {
  file: string;
  slug: string;
  title: string;
  description: string;
  tech: string[];
  url: string;
  order: number;
  draft: boolean;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

function assertFile(file: string): void {
  if (!existsSync(join(root, file))) fail(`missing required file: ${file}`);
}

function assertContains(file: string, text: string): void {
  if (!existsSync(join(root, file))) return;
  if (!readText(file).includes(text)) fail(`${file} does not contain: ${text}`);
}

function walk(directory: string, keep: (file: string) => boolean): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(rel(child), keep));
    } else if (entry.isFile() && keep(child)) {
      files.push(child);
    }
  }
  return files;
}

function asDate(value: unknown, label: string): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  fail(`${label} must be an ISO date (YYYY-MM-DD)`);
  return undefined;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${label} must be a non-empty array of strings`);
    return [];
  }
  return value.map((item) => item.trim());
}

function frontMatter(file: string): { data: RecordValue; body: string } | undefined {
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?/);
  if (!match) {
    fail(`${rel(file)} must start with TOML +++ front matter`);
    return undefined;
  }

  try {
    const data = parseToml(match[1]);
    return { data, body: text.slice(match[0].length) };
  } catch (error) {
    fail(`${rel(file)} has invalid TOML front matter: ${String(error)}`);
    return undefined;
  }
}

function loadPosts(): BlogRecord[] {
  const posts: BlogRecord[] = [];
  const slugs = new Set<string>();

  for (const file of walk('src/content/blog', (path) => extname(path) === '.md')) {
    const parsed = frontMatter(file);
    if (!parsed) continue;

    const { data, body } = parsed;
    const label = rel(file);
    const title = data.title;
    const description = data.description;
    const date = asDate(data.date, `${label}: date`);
    const updated = asDate(data.updated, `${label}: updated`);
    const draft = data.draft === true;

    if (typeof title !== 'string' || !title.trim()) fail(`${label}: title must be a string`);
    if (typeof description !== 'string' || !description.trim()) {
      fail(`${label}: description must be a string`);
    }

    const taxonomy = isRecord(data.taxonomies) ? data.taxonomies : {};
    const tags = asStringArray(taxonomy.tags ?? [], `${label}: taxonomies.tags`);
    if (new Set(tags).size !== tags.length) fail(`${label}: tags must be unique`);
    const slug = rel(file)
      .replace(/^src\/content\/blog\//, '')
      .replace(/\.md$/, '');

    if (slugs.has(slug)) fail(`duplicate blog slug: ${slug}`);
    slugs.add(slug);

    if (typeof title === 'string' && typeof description === 'string' && date) {
      posts.push({
        file: label,
        slug,
        title,
        date,
        updated,
        draft,
        description,
        tags,
        body,
      });
    }
  }

  if (posts.length === 0) fail('no blog entries found in src/content/blog');
  return posts.sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

function loadProjects(): ProjectRecord[] {
  const projects: ProjectRecord[] = [];

  for (const file of walk('src/content/projects', (path) => extname(path) === '.md')) {
    const parsed = frontMatter(file);
    if (!parsed) continue;

    const { data } = parsed;
    const label = rel(file);
    const title = data.title;
    const description = data.description;
    const url = data.url;
    const order = data.order;
    const tech = asStringArray(data.tech ?? [], `${label}: tech`);
    const slug = rel(file)
      .replace(/^src\/content\/projects\//, '')
      .replace(/\.md$/, '');

    if (typeof title !== 'string' || !title.trim()) fail(`${label}: title must be a string`);
    if (typeof description !== 'string' || !description.trim()) {
      fail(`${label}: description must be a string`);
    }
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) {
      fail(`${label}: url must be an https URL`);
    }
    if (typeof order !== 'number' || !Number.isInteger(order)) {
      fail(`${label}: order must be an integer`);
    }

    if (
      typeof title === 'string' &&
      typeof description === 'string' &&
      typeof url === 'string' &&
      typeof order === 'number'
    ) {
      projects.push({
        file: label,
        slug,
        title,
        description,
        tech,
        url,
        order,
        draft: data.draft === true,
      });
    }
  }

  if (projects.length === 0) fail('no project entries found in src/content/projects');
  return projects.sort((a, b) => a.order - b.order);
}

function slugifyTag(tag: string): string {
  return tag
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTagIndex(posts: BlogRecord[]): Map<string, string> {
  const tags = new Map<string, string>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const slug = slugifyTag(tag);
      if (!slug) {
        fail(`${post.file}: tag cannot be converted to a URL slug: ${JSON.stringify(tag)}`);
        continue;
      }

      const existing = tags.get(slug);
      if (existing && existing !== tag) {
        fail(
          `tag slug collision: ${JSON.stringify(existing)} and ${JSON.stringify(tag)} both map to /tags/${slug}/`,
        );
      }
      tags.set(slug, tag);
    }
  }

  return tags;
}

function trackedFiles(): string[] | undefined {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split('\0').filter(Boolean);
  } catch {
    return undefined;
  }
}

function sourceFilesForSecrets(): string[] {
  const tracked = trackedFiles();
  if (tracked && tracked.length > 0) return tracked.map((file) => join(root, file));

  const skippedDirectories = new Set([
    '.git',
    '.astro',
    '.cache',
    '.netlify',
    '.turbo',
    '.vercel',
    '.visual',
    '.wrangler',
    'dist',
    'node_modules',
    'playwright-report',
    'test-results',
  ]);

  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) visit(child);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
        if (entry.name === '.dev.vars') continue;
        files.push(child);
      }
    }
  };
  visit(root);
  return files;
}

function checkSecrets(): void {
  const privateKey = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
  const credential =
    /(password|passwd|secret|api[-_]?key|access[-_]?key|client[-_]?secret|auth[-_]?token)\s*[:=]\s*\S{8,}/i;
  const forbiddenName = /(^|\/)(id_(rsa|ed25519|ecdsa|dsa)|[^/]+\.(pem|key|ppk|p12|pfx))$/i;
  const textExtensions = new Set([
    '.astro',
    '.cjs',
    '.css',
    '.fish',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.toml',
    '.ts',
    '.txt',
    '.yaml',
    '.yml',
  ]);
  const textNames = new Set(['.gitignore', '.npmrc', 'justfile']);

  const files = sourceFilesForSecrets();
  for (const file of files) {
    if (!existsSync(file)) continue;

    const relativeFile = rel(file);
    if (forbiddenName.test(relativeFile)) {
      fail(`private-key filename is tracked: ${relativeFile}`);
      continue;
    }

    if (
      (!textExtensions.has(extname(file)) && !textNames.has(basename(file))) ||
      statSync(file).size > 1_000_000
    ) {
      continue;
    }
    const text = readFileSync(file, 'utf8');

    if (privateKey.test(text)) fail(`private-key material found in ${relativeFile}`);
    if (credential.test(text)) fail(`credential-shaped string found in ${relativeFile}`);
  }
}

function checkSource(): void {
  const required = [
    'AGENTS.md',
    'README.md',
    'astro.config.mjs',
    'package.json',
    'tsconfig.json',
    'src/content.config.ts',
    'src/layouts/BaseLayout.astro',
    'src/pages/index.astro',
    'src/pages/blog/index.astro',
    'src/pages/blog/[...slug].astro',
    'src/pages/tags/index.astro',
    'src/pages/tags/[tag].astro',
    'src/styles/site.css',
    'src/scripts/site.ts',
    'public/CNAME',
    'public/robots.txt',
    '.github/workflows/deploy.yml',
  ];
  required.forEach(assertFile);

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

  assertContains('astro.config.mjs', "site: 'https://hech.dev'");
  assertContains('astro.config.mjs', "theme: 'catppuccin-mocha'");
  assertContains('astro.config.mjs', 'process.env.PORT ?? 3000');
  assertContains('.github/workflows/deploy.yml', 'actions/configure-pages@v5');
  assertContains('.github/workflows/deploy.yml', 'actions/upload-pages-artifact@v3');
  assertContains('.github/workflows/deploy.yml', 'actions/deploy-pages@v4');
  assertContains('src/styles/site.css', 'background: #181825;');
  assertContains('src/styles/site.css', 'border-radius: 8px;');
  assertContains('src/styles/site.css', '.post-item__meta');
  assertContains('src/scripts/site.ts', "const storageKey = 'dev-journal-theme';");
  assertContains('src/scripts/site.ts', 'navigator.clipboard.writeText');

  const pkg = JSON.parse(readText('package.json')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  for (const script of ['dev', 'build', 'check', 'check:built']) {
    if (!pkg.scripts?.[script]) fail(`package.json is missing the "${script}" script`);
  }
  for (const tool of ['just', 'fish', 'rg']) {
    if (pkg.scripts?.dev?.includes(tool) || pkg.scripts?.build?.includes(tool)) {
      fail(`package.json dev/build scripts must not depend on ${tool}`);
    }
  }

  const tracked = trackedFiles();
  if (tracked) {
    for (const file of tracked) {
      if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) {
        fail(`non-Bun lockfile is tracked: ${file}`);
      }
      if (/(^|\/)(dist|\.astro|\.visual|test-results|playwright-report)\//.test(file)) {
        fail(`generated artifact is tracked: ${file}`);
      }
    }
  }

  const posts = loadPosts();
  loadProjects();
  const tags = buildTagIndex(posts);

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

  for (const file of walk('src', (path) => extname(path) === '.astro')) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const target = match[1];
      if (target.startsWith('//') || target.includes('{')) continue;
      const path = target.split(/[?#]/)[0];
      if (path === '/' || routes.has(path)) continue;
      if (path.startsWith('/_astro') || path === '/CNAME' || path === '/robots.txt') continue;
      fail(`${rel(file)}: internal asset or link has no known target: ${target}`);
    }
  }

  checkSecrets();

  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exit(1);
  }

  console.log(`check: source contract ok (${posts.length} posts, ${tags.size} tags)`);
}

function builtFileForPath(pathname: string): string {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]);
  if (clean === '/') return join(root, 'dist/index.html');
  if (extname(clean)) return join(root, 'dist', clean.replace(/^\//, ''));
  return join(root, 'dist', clean.replace(/^\//, ''), 'index.html');
}

function checkBuilt(): void {
  if (!existsSync(join(root, 'dist'))) {
    console.error('FAIL: dist/ is missing; run "bun run build" first');
    process.exit(1);
  }

  const posts = loadPosts();
  const tags = buildTagIndex(posts);
  const requiredPages = [
    'index.html',
    '404.html',
    'blog/index.html',
    'tags/index.html',
    ...posts.map((post) => `blog/${post.slug}/index.html`),
    ...[...tags.keys()].map((slug) => `tags/${slug}/index.html`),
  ];

  for (const page of requiredPages) {
    if (!existsSync(join(root, 'dist', page))) fail(`built page is missing: dist/${page}`);
  }

  if (!existsSync(join(root, 'dist/sitemap-index.xml'))) {
    fail('built sitemap is missing: dist/sitemap-index.xml');
  }

  const htmlFiles = walk('dist', (path) => extname(path) === '.html');
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const page = rel(file).replace(/^dist\//, '');

    if (!/<html[^>]*lang="en"/.test(html)) fail(`${page}: missing lang="en"`);
    if (!/<html[^>]*data-theme="mocha"/.test(html)) fail(`${page}: missing default Mocha theme`);

    for (const match of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const target = match[1];
      if (target.startsWith('//')) continue;
      const path = target.split(/[?#]/)[0];
      if (!path || path === '/') {
        if (!existsSync(join(root, 'dist/index.html')))
          fail(`${page}: link to / has no index.html`);
        continue;
      }
      if (!existsSync(builtFileForPath(path))) {
        fail(`${page}: broken internal asset or link: ${target}`);
      }
    }

    for (const anchor of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const attributes = anchor[1];
      if (!/\btarget="_blank"/.test(attributes)) continue;
      if (!/\brel="[^"]*noopener[^"]*noreferrer[^"]*"/.test(attributes)) {
        fail(`${page}: external link missing rel="noopener noreferrer"`);
      }
      if (!/\bclass="[^"]*external-link[^"]*"/.test(attributes)) {
        fail(`${page}: external link missing class="external-link"`);
      }
      if (!anchor[2].includes('↗')) fail(`${page}: external link missing the ↗ glyph`);
    }
  }

  const home = readText('dist/index.html');
  for (const text of ['Hi, I’m Chen.', 'Latest articles', 'Selected projects']) {
    if (!home.includes(text)) fail(`home page is missing: ${text}`);
  }
  for (const url of [
    'https://github.com/flasheddy/price-drop-monitor',
    'https://github.com/flasheddy/event-aggregation-pipeline',
  ]) {
    if (!home.includes(url)) fail(`home page is missing project URL: ${url}`);
  }
  if (!home.includes('Built with Astro.')) fail('footer must say Built with Astro.');

  for (const post of posts) {
    const html = readText(`dist/blog/${post.slug}/index.html`);
    for (const text of [post.title, 'Back to Articles', 'min read']) {
      if (!html.includes(text)) fail(`article ${post.slug} is missing: ${text}`);
    }
    if (post.body.includes('```') && !html.includes('astro-code catppuccin-mocha')) {
      fail(`article ${post.slug}: Catppuccin Mocha syntax highlighting is missing`);
    }

    const hasDistinctUpdate = Boolean(
      post.updated && post.updated.valueOf() !== post.date.valueOf(),
    );
    if (hasDistinctUpdate) {
      if (!/Updated\s*<time/.test(html)) {
        fail(`article ${post.slug}: distinct updated date is not rendered`);
      }
      if (post.updated) {
        const formatted = new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(post.updated);
        if (!html.includes(formatted)) {
          fail(`article ${post.slug}: updated date text is missing (${formatted})`);
        }
      }
    } else if (/Updated\s*<time/.test(html)) {
      fail(`article ${post.slug}: updated date rendered when it is absent or equal to date`);
    }
  }

  const feedPages = [
    'dist/index.html',
    'dist/blog/index.html',
    ...[...tags.keys()].map((slug) => `dist/tags/${slug}/index.html`),
  ];
  for (const file of feedPages) {
    if (existsSync(join(root, file)) && !readText(file).includes('post-item__meta')) {
      fail(`${file}: feed cards are missing .post-item__meta`);
    }
  }

  console.log(`check: built contract ok (${htmlFiles.length} HTML pages)`);
}

if (builtMode) {
  checkBuilt();
} else {
  checkSource();
}
