import { readFileSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import { indexTags } from '../../src/lib/tags';
import { isRecord, type RecordValue } from './util';

export type { RecordValue } from './util';

export type BlogRecord = {
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

export type ProjectRecord = {
  file: string;
  slug: string;
  title: string;
  description: string;
  tech: string[];
  url: string;
  order: number;
  draft: boolean;
};

export type Reporter = (message: string) => void;

function asDate(value: unknown, label: string, fail: Reporter, required = false): Date | undefined {
  if (value === undefined) {
    if (required) fail(`${label} must be an ISO date (YYYY-MM-DD)`);
    return undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return new Date(value.valueOf());
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  fail(`${label} must be an ISO date (YYYY-MM-DD)`);
  return undefined;
}

function asStringArray(value: unknown, label: string, fail: Reporter): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${label} must be a non-empty array of strings`);
    return [];
  }
  return value.map((item) => item.trim());
}

function frontMatter(
  file: string,
  fail: Reporter,
  rel: (path: string) => string,
): { data: RecordValue; body: string } | undefined {
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

export function loadPosts(
  files: readonly string[],
  fail: Reporter,
  rel: (path: string) => string,
): BlogRecord[] {
  const posts: BlogRecord[] = [];
  const slugs = new Set<string>();

  for (const file of files) {
    const parsed = frontMatter(file, fail, rel);
    if (!parsed) continue;

    const { data, body } = parsed;
    const label = rel(file);
    const title = data.title;
    const description = data.description;
    const date = asDate(data.date, `${label}: date`, fail, true);
    const updated = asDate(data.updated, `${label}: updated`, fail);
    const draft = data.draft === true;

    if (typeof title !== 'string' || !title.trim()) fail(`${label}: title must be a string`);
    if (typeof description !== 'string' || !description.trim()) {
      fail(`${label}: description must be a string`);
    }

    const taxonomy = isRecord(data.taxonomies) ? data.taxonomies : {};
    const tags = asStringArray(taxonomy.tags ?? [], `${label}: taxonomies.tags`, fail);
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
  return posts.sort((a, b) => {
    const byDate = b.date.valueOf() - a.date.valueOf();
    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
  });
}

export function loadProjects(
  files: readonly string[],
  fail: Reporter,
  rel: (path: string) => string,
): ProjectRecord[] {
  const projects: ProjectRecord[] = [];

  for (const file of files) {
    const parsed = frontMatter(file, fail, rel);
    if (!parsed) continue;

    const { data } = parsed;
    const label = rel(file);
    const title = data.title;
    const description = data.description;
    const url = data.url;
    const order = data.order;
    const tech = asStringArray(data.tech ?? [], `${label}: tech`, fail);
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

export function buildTagMap(posts: readonly BlogRecord[], fail: Reporter): Map<string, string> {
  return new Map(
    indexTags(
      posts,
      (post) => post.tags,
      (message, post) => {
        fail(`${post.file}: ${message}`);
      },
    ).map(({ slug, name }) => [slug, name] as const),
  );
}
