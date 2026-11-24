export type TaggedPost = { data: { tags: string[] } };
export type TagEntry<T extends TaggedPost = TaggedPost> = {
  name: string;
  slug: string;
  posts: T[];
};

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

export function indexTags<T extends TaggedPost>(posts: readonly T[]): TagEntry<T>[] {
  const tags = new Map<string, TagEntry<T>>();

  for (const post of posts) {
    for (const name of post.data.tags) {
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
