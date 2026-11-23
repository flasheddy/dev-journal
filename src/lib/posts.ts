import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;
export type Project = CollectionEntry<'projects'>;

export type TagEntry = {
  name: string;
  slug: string;
  posts: BlogPost[];
};

export async function getPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  return posts.sort((a, b) => {
    const byDate = b.data.date.valueOf() - a.data.date.valueOf();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) => !data.draft);

  return projects.sort((a, b) => {
    const byOrder = a.data.order - b.data.order;
    return byOrder !== 0 ? byOrder : a.id.localeCompare(b.id);
  });
}

export function postPath(post: BlogPost): string {
  return `/blog/${post.id}/`;
}

export function slugifyTag(tag: string): string {
  return tag
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tagPath(tag: string): string {
  const slug = slugifyTag(tag);

  if (!slug) {
    throw new Error(`Tag cannot be converted to a URL slug: ${JSON.stringify(tag)}`);
  }

  return `/tags/${slug}/`;
}

export function postTags(post: BlogPost): string[] {
  return post.data.tags;
}

export function isUpdated(post: BlogPost): boolean {
  return Boolean(post.data.updated && post.data.updated.valueOf() !== post.data.date.valueOf());
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date, month: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-US', {
    month,
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function countWords(text: string): number {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    let words = 0;
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) words += 1;
    }
    return words;
  }

  return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function readingTime(body: string): number {
  // Match the previous reading analytics: ignore fenced code and read English at 238 wpm.
  const prose = body
    .split('```')
    .filter((_, index) => index % 2 === 0)
    .join('');
  return Math.max(1, Math.ceil(countWords(prose) / 238));
}

export async function getTagIndex(): Promise<TagEntry[]> {
  const posts = await getPosts();
  const tags = new Map<string, TagEntry>();

  for (const post of posts) {
    for (const name of postTags(post)) {
      const slug = slugifyTag(name);

      if (!slug) {
        throw new Error(`Tag cannot be converted to a URL slug: ${JSON.stringify(name)}`);
      }

      const existing = tags.get(slug);
      if (existing && existing.name !== name) {
        throw new Error(
          `Tag slug collision: ${JSON.stringify(existing.name)} and ${JSON.stringify(name)} both map to /tags/${slug}/`,
        );
      }

      if (existing) {
        existing.posts.push(post);
      } else {
        tags.set(slug, { name, slug, posts: [post] });
      }
    }
  }

  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
}
