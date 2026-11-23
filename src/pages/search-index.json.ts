import type { APIRoute } from 'astro';
import { getPosts, getProjects, isoDate, postPath, postTags } from '../lib/posts';

export interface SearchIndexItem {
  kind: 'article' | 'project';
  title: string;
  summary: string;
  url: string;
  tags: string[];
  date?: string;
}

export const GET: APIRoute = async () => {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);

  const items: SearchIndexItem[] = [
    ...posts.map((post) => ({
      kind: 'article' as const,
      title: post.data.title,
      summary: post.data.description,
      url: postPath(post),
      tags: postTags(post),
      date: isoDate(post.data.date),
    })),
    ...projects.map((project) => ({
      kind: 'project' as const,
      title: project.data.title,
      summary: project.data.description,
      url: project.data.url,
      tags: project.data.tech,
    })),
  ];

  return new Response(JSON.stringify(items), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
