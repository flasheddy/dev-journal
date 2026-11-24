import { getCollection, type CollectionEntry } from 'astro:content';
import { formatDate, isUpdated, isoDate } from './dates';
import { sortPostsByDate, sortProjectsByOrder } from './ordering';
import { readingTime } from './reading-time';
import { indexTags, slugifyTag, tagPath, type TagEntry as TagIndexEntry } from './tags';

export { slugifyTag, tagPath };
export { formatDate, isUpdated, isoDate, readingTime };

export type BlogPost = CollectionEntry<'blog'>;
export type Project = CollectionEntry<'projects'>;

export type TagEntry = TagIndexEntry<BlogPost>;

export async function getPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  return sortPostsByDate(posts);
}

export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) => !data.draft);

  return sortProjectsByOrder(projects);
}

export function postPath(post: BlogPost): string {
  return `/blog/${post.id}/`;
}

export function postTags(post: BlogPost): string[] {
  return post.data.tags;
}

export async function getTagIndex(): Promise<TagEntry[]> {
  return indexTags(await getPosts());
}
