import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import type { AiCorpusChunk } from '../lib/contracts';
import {
  MAX_CHUNK_CHARS,
  normalizeInlineSpace,
  splitIntoChunks,
  splitMarkdownByHeadings,
  stripMarkdownToPlainText,
  truncateAtWordBoundary,
} from '../lib/markdown';
import { getPosts, getProjects, isoDate, postPath, postTags } from '../lib/posts';

export const GET: APIRoute = async () => {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);
  const chunks: AiCorpusChunk[] = [];

  for (const post of posts) {
    const { headings } = await render(post);
    const baseUrl = postPath(post);
    const tags = postTags(post);
    const date = isoDate(post.data.date);
    const sections = splitMarkdownByHeadings(post.body ?? '', headings);

    let addedForPost = 0;
    for (const section of sections) {
      const plain = stripMarkdownToPlainText(section.markdown);
      const parts = splitIntoChunks(plain, MAX_CHUNK_CHARS);
      const url = section.slug ? `${baseUrl}#${section.slug}` : baseUrl;

      for (const text of parts) {
        chunks.push({
          kind: 'article',
          title: post.data.title,
          section: section.section,
          url,
          tags,
          text,
          date,
        });
        addedForPost += 1;
      }
    }

    if (addedForPost === 0) {
      chunks.push({
        kind: 'article',
        title: post.data.title,
        section: 'Overview',
        url: baseUrl,
        tags,
        text: truncateAtWordBoundary(normalizeInlineSpace(post.data.description), MAX_CHUNK_CHARS),
        date,
      });
    }
  }

  for (const project of projects) {
    const bodyPlain = stripMarkdownToPlainText(project.body ?? '');
    const combined = [
      normalizeInlineSpace(project.data.description),
      bodyPlain ? normalizeInlineSpace(bodyPlain) : '',
      project.data.tech.length > 0 ? `Technologies: ${project.data.tech.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const parts = splitIntoChunks(combined, MAX_CHUNK_CHARS);
    const texts = parts.length > 0 ? parts : [truncateAtWordBoundary(combined, MAX_CHUNK_CHARS)];

    for (const text of texts) {
      chunks.push({
        kind: 'project',
        title: project.data.title,
        section: 'Overview',
        url: project.data.url,
        tags: project.data.tech,
        text,
      });
    }
  }

  return new Response(JSON.stringify(chunks), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
