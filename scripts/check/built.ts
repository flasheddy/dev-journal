import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { validateAiCorpus, validateSearchIndex, type ExpectedSearchItem } from './artifacts';
import { buildTagIndex, loadPosts, loadProjects, type Reporter } from './content';
import { readText, rel, walk } from './files';
import { isRecord } from './util';

const SITE_URL = 'https://hech.dev';
const RFC_822 =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function builtFileForPath(root: string, pathname: string): string {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]);
  if (clean === '/') return join(root, 'dist/index.html');
  if (extname(clean)) return join(root, 'dist', clean.replace(/^\//, ''));
  return join(root, 'dist', clean.replace(/^\//, ''), 'index.html');
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const XML_ENTITIES = /&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);)/;
const XML_TAG =
  /<\s*(\/?)\s*([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)\s*>/g;

function assertWellFormedXml(label: string, xml: string, fail: Reporter): void {
  const document = xml.replace(/^\uFEFF/, '');
  if (!/^<\?xml\s+version\s*=\s*["']1\.[0-9]+["']/.test(document)) {
    fail(`${label}: missing XML declaration`);
    return;
  }

  const body = document
    .replace(/^<\?xml[\s\S]*?\?>\s*/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '');

  const stack: string[] = [];
  let roots = 0;
  let rootName = '';
  let cursor = 0;

  const checkText = (text: string, position: number): void => {
    if (text.includes('<')) fail(`${label}: malformed markup near character ${position}`);
    if (XML_ENTITIES.test(text)) fail(`${label}: invalid entity near character ${position}`);
  };

  for (const match of body.matchAll(XML_TAG)) {
    const index = match.index ?? 0;
    const between = body.slice(cursor, index);
    checkText(between, cursor);
    if (stack.length === 0 && between.trim() !== '') {
      fail(`${label}: text outside the root element`);
    }
    cursor = index + match[0].length;

    const closing = match[1] === '/';
    const name = match[2];
    const selfClosing = match[4] === '/';

    if (closing) {
      if (selfClosing) {
        fail(`${label}: malformed closing tag </${name}/>`);
        continue;
      }
      const open = stack.pop();
      if (open !== name) fail(`${label}: mismatched closing tag </${name}>`);
      continue;
    }

    if (stack.length === 0) {
      roots += 1;
      if (roots === 1) rootName = name;
    }
    if (!selfClosing) stack.push(name);
  }

  const tail = body.slice(cursor);
  checkText(tail, cursor);
  if (stack.length === 0 && tail.trim() !== '') fail(`${label}: text outside the root element`);
  if (stack.length > 0) fail(`${label}: unclosed element <${stack[stack.length - 1]}>`);
  if (roots !== 1) fail(`${label}: expected exactly one root element, found ${roots}`);
  if (rootName !== 'rss') fail(`${label}: root element must be <rss>, found <${rootName}>`);
  if (!/<rss\b[^>]*\bversion="2\.0"/.test(body)) fail(`${label}: missing RSS 2.0 version`);
}

function expectedCanonical(page: string): string | undefined {
  if (page === '404.html') return undefined;
  const path = page === 'index.html' ? '' : page.replace(/\/index\.html$/, '/');
  return new URL(`/${path}`, SITE_URL).href;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function checkPng(root: string, file: string, fail: Reporter): void {
  const data = readFileSync(file);
  if (data.length < 1024) {
    fail(`${rel(root, file)}: PNG is empty or truncated (${data.length} bytes)`);
    return;
  }
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${rel(root, file)}: missing PNG signature`);
    return;
  }

  const headerLength = data.readUInt32BE(8);
  const headerType = data.subarray(12, 16).toString('ascii');
  if (headerLength !== 13 || headerType !== 'IHDR') {
    fail(`${rel(root, file)}: missing PNG IHDR chunk`);
    return;
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    fail(`${rel(root, file)}: expected a 1200x630 PNG, found ${width}x${height}`);
  }

  const trailerType = data.subarray(data.length - 8, data.length - 4).toString('ascii');
  if (trailerType !== 'IEND') {
    fail(`${rel(root, file)}: PNG is missing its IEND chunk`);
  }
}

function readJsonArtifact(root: string, file: string, fail: Reporter): unknown {
  try {
    return JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch {
    fail(`${file}: invalid JSON`);
    return undefined;
  }
}

export function checkBuilt(root: string, fail: Reporter): { pages: number } {
  if (!existsSync(join(root, 'dist'))) {
    fail('dist/ is missing; run "bun run build" first');
    return { pages: 0 };
  }

  const posts = loadPosts(
    walk(root, 'src/content/blog', (path) => extname(path) === '.md'),
    fail,
    (path) => rel(root, path),
  );
  const published = posts.filter((post) => !post.draft);
  const projects = loadProjects(
    walk(root, 'src/content/projects', (path) => extname(path) === '.md'),
    fail,
    (path) => rel(root, path),
  ).filter((project) => !project.draft);
  const expectedSearchItems: ExpectedSearchItem[] = [
    ...published.map((post) => ({
      kind: 'article' as const,
      title: post.title,
      url: `/blog/${post.slug}/`,
    })),
    ...projects.map((project) => ({
      kind: 'project' as const,
      title: project.title,
      url: project.url,
    })),
  ];
  const tags = buildTagIndex(published, fail);
  const requiredPages = [
    'index.html',
    '404.html',
    'blog/index.html',
    'tags/index.html',
    ...published.map((post) => `blog/${post.slug}/index.html`),
    ...[...tags.keys()].map((slug) => `tags/${slug}/index.html`),
  ];

  for (const page of requiredPages) {
    if (!existsSync(join(root, 'dist', page))) fail(`built page is missing: dist/${page}`);
  }

  if (!existsSync(join(root, 'dist/sitemap-index.xml'))) {
    fail('built sitemap is missing: dist/sitemap-index.xml');
  }

  const searchIndexFile = 'dist/search-index.json';
  if (!existsSync(join(root, searchIndexFile))) {
    fail(`built artifact is missing: ${searchIndexFile}`);
  } else {
    const searchIndex = readJsonArtifact(root, searchIndexFile, fail);
    if (searchIndex !== undefined) validateSearchIndex(searchIndex, expectedSearchItems, fail);
  }

  const aiCorpusFile = 'dist/ai-corpus.json';
  if (!existsSync(join(root, aiCorpusFile))) {
    fail(`built artifact is missing: ${aiCorpusFile}`);
  } else {
    const aiCorpus = readJsonArtifact(root, aiCorpusFile, fail);
    if (aiCorpus !== undefined) validateAiCorpus(aiCorpus, fail);
  }

  const rssPath = join(root, 'dist/rss.xml');
  if (!existsSync(rssPath)) {
    fail('built RSS feed is missing: dist/rss.xml');
  } else {
    const rss = readFileSync(rssPath, 'utf8');
    assertWellFormedXml('dist/rss.xml', rss, fail);

    const lastBuildDate = rss.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1];
    if (!lastBuildDate || !RFC_822.test(lastBuildDate)) {
      fail('dist/rss.xml: missing or invalid RFC-822 lastBuildDate');
    }

    const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    if (items.length !== published.length) {
      fail(`dist/rss.xml: expected ${published.length} items, found ${items.length}`);
    }

    for (const [index, post] of published.entries()) {
      const item = items[index];
      if (!item) continue;

      const read = (name: string): string | undefined => {
        const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
        return match ? decodeXml(match[1]) : undefined;
      };

      const expectedUrl = new URL(`/blog/${post.slug}/`, SITE_URL).href;
      if (read('title') !== post.title) {
        fail(`dist/rss.xml: item ${index + 1} has the wrong title`);
      }
      if (read('link') !== expectedUrl) {
        fail(`dist/rss.xml: item ${post.slug} has the wrong link`);
      }
      if (read('guid') !== expectedUrl) {
        fail(`dist/rss.xml: item ${post.slug} has the wrong guid`);
      }
      if (read('description') !== post.description) {
        fail(`dist/rss.xml: item ${post.slug} has the wrong description`);
      }

      const pubDate = read('pubDate');
      if (!pubDate || !RFC_822.test(pubDate) || Date.parse(pubDate) !== post.date.valueOf()) {
        fail(`dist/rss.xml: item ${post.slug} has an invalid RFC-822 pubDate`);
      }
    }
  }

  const defaultOgPath = join(root, 'dist/og/default.png');
  if (!existsSync(defaultOgPath)) {
    fail('built OG image is missing: dist/og/default.png');
  } else {
    checkPng(root, defaultOgPath, fail);
  }

  for (const post of published) {
    const ogPath = join(root, 'dist/og', `${post.slug}.png`);
    if (!existsSync(ogPath)) {
      fail(`built OG image is missing: dist/og/${post.slug}.png`);
    } else {
      checkPng(root, ogPath, fail);
    }
  }

  const htmlFiles = walk(root, 'dist', (path) => extname(path) === '.html');
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const page = rel(root, file).replace(/^dist\//, '');

    if (!/<html[^>]*lang="en"/.test(html)) fail(`${page}: missing lang="en"`);
    if (!/<html[^>]*data-theme="mocha"/.test(html)) fail(`${page}: missing default Mocha theme`);

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!canonicalMatch) {
      fail(`${page}: missing canonical link`);
    } else {
      const canonical = canonicalMatch[1];
      const expected = expectedCanonical(page);
      if (!/^https:\/\/hech\.dev\//.test(canonical)) {
        fail(`${page}: canonical link must be an absolute https://hech.dev URL`);
      }
      if (expected && canonical !== expected) {
        fail(`${page}: canonical should be ${expected}, found ${canonical}`);
      }
    }

    if (page === '404.html' && !/<meta name="robots" content="noindex"/.test(html)) {
      fail(`${page}: missing noindex`);
    }

    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/);
    if (!ogTitle || !ogTitle[1].trim()) fail(`${page}: missing og:title`);
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)"/);
    if (!ogDescription || !ogDescription[1].trim()) fail(`${page}: missing og:description`);

    const expectedOgType = /^blog\/.+\/index\.html$/.test(page) ? 'article' : 'website';
    const ogType = html.match(/<meta property="og:type" content="([^"]*)"/);
    if (ogType?.[1] !== expectedOgType) {
      fail(`${page}: og:type should be ${expectedOgType}`);
    }

    const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/);
    if (!ogUrl || (canonicalMatch && ogUrl[1] !== canonicalMatch[1])) {
      fail(`${page}: missing or incorrect og:url`);
    }

    const twitterCard = html.match(/<meta name="twitter:card" content="([^"]*)"/);
    if (!twitterCard || !twitterCard[1].trim()) fail(`${page}: missing twitter:card`);
    if (twitterCard?.[1] !== 'summary_large_image') {
      fail(`${page}: twitter:card should be summary_large_image`);
    }

    const postSlug = page.match(/^blog\/(.+)\/index\.html$/)?.[1];
    const expectedOgImage = new URL(postSlug ? `/og/${postSlug}.png` : '/og/default.png', SITE_URL)
      .href;
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogImage?.[1] !== expectedOgImage) {
      fail(`${page}: og:image should be ${expectedOgImage}`);
    }
    const ogImageWidth = html.match(/<meta property="og:image:width" content="([^"]+)"/);
    if (ogImageWidth?.[1] !== '1200') {
      fail(`${page}: og:image:width should be 1200`);
    }
    const ogImageHeight = html.match(/<meta property="og:image:height" content="([^"]+)"/);
    if (ogImageHeight?.[1] !== '630') {
      fail(`${page}: og:image:height should be 630`);
    }
    const twitterImage = html.match(/<meta name="twitter:image" content="([^"]+)"/);
    if (twitterImage?.[1] !== expectedOgImage) {
      fail(`${page}: twitter:image should be ${expectedOgImage}`);
    }

    if (
      !/<link rel="alternate" type="application\/rss\+xml"[^>]*href="https:\/\/hech\.dev\/rss\.xml"/.test(
        html,
      )
    ) {
      fail(`${page}: missing RSS alternate link`);
    }
    if (!/class="site-footer__rss"[^>]*href="\/rss\.xml"/.test(html)) {
      fail(`${page}: missing footer RSS link`);
    }

    for (const match of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const target = match[1];
      if (target.startsWith('//')) continue;
      const path = target.split(/[?#]/)[0];
      if (!path || path === '/') {
        if (!existsSync(join(root, 'dist/index.html')))
          fail(`${page}: link to / has no index.html`);
        continue;
      }
      if (!existsSync(builtFileForPath(root, path))) {
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

  const home = readText(root, 'dist/index.html');
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

  for (const post of published) {
    const articlePage = `blog/${post.slug}/index.html`;
    if (!existsSync(join(root, 'dist', articlePage))) {
      fail(`built page is missing: dist/${articlePage}`);
      continue;
    }
    const html = readText(root, `dist/${articlePage}`);
    for (const text of [post.title, 'Back to Articles', 'min read']) {
      if (!html.includes(text)) fail(`article ${post.slug} is missing: ${text}`);
    }
    if (post.body.includes('```') && !html.includes('astro-code catppuccin-mocha')) {
      fail(`article ${post.slug}: Catppuccin Mocha syntax highlighting is missing`);
    }

    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!jsonLdMatch) {
      fail(`article ${post.slug}: missing application/ld+json BlogPosting`);
    } else {
      try {
        const data = JSON.parse(jsonLdMatch[1]) as Record<string, unknown>;
        const author = isRecord(data.author) ? data.author.name : data.author;
        const expectedModified = (post.updated ?? post.date).toISOString();

        if (data['@context'] !== 'https://schema.org') {
          fail(`article ${post.slug}: JSON-LD @context is incorrect`);
        }
        if (data['@type'] !== 'BlogPosting') {
          fail(`article ${post.slug}: JSON-LD @type must be BlogPosting`);
        }
        if (data.headline !== post.title) {
          fail(`article ${post.slug}: JSON-LD headline is incorrect`);
        }
        if (data.datePublished !== post.date.toISOString()) {
          fail(`article ${post.slug}: JSON-LD datePublished is incorrect`);
        }
        if (data.dateModified !== expectedModified) {
          fail(`article ${post.slug}: JSON-LD dateModified is incorrect`);
        }
        if (typeof author !== 'string' || !author.trim()) {
          fail(`article ${post.slug}: JSON-LD author is missing`);
        }
        if (data.keywords !== post.tags.join(', ')) {
          fail(`article ${post.slug}: JSON-LD keywords are incorrect`);
        }
      } catch (error) {
        fail(`article ${post.slug}: invalid JSON-LD (${String(error)})`);
      }
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
    if (existsSync(join(root, file)) && !readText(root, file).includes('post-item__meta')) {
      fail(`${file}: feed cards are missing .post-item__meta`);
    }
  }

  return { pages: htmlFiles.length };
}
