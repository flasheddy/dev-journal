export type TagEntry<T> = {
  name: string;
  slug: string;
  posts: T[];
};

export type TagIndexReporter<T> = (message: string, post: T) => void;

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

export function indexTags<T>(
  posts: readonly T[],
  tagsOf: (post: T) => readonly string[],
  fail: TagIndexReporter<T> = (message) => {
    throw new Error(message);
  },
): TagEntry<T>[] {
  const tags = new Map<string, TagEntry<T>>();

  for (const post of posts) {
    for (const name of tagsOf(post)) {
      const slug = slugifyTag(name);

      if (!slug) {
        fail(`Tag cannot be converted to a URL slug: ${JSON.stringify(name)}`, post);
        continue;
      }

      const existing = tags.get(slug);
      if (existing && existing.name !== name) {
        fail(
          `Tag slug collision: ${JSON.stringify(existing.name)} and ${JSON.stringify(name)} both map to /tags/${slug}/`,
          post,
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
