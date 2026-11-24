import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { getPosts, getProjects, isoDate, postPath, postTags } from '../lib/posts';

export interface AiCorpusChunk {
  kind: 'article' | 'project';
  title: string;
  section: string;
  url: string;
  tags: string[];
  text: string;
  date?: string;
}

const MAX_CHUNK_CHARS = 700;

function stripMarkdownToPlainText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const cleanedLines: string[] = [];
  let inCodeFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      if (trimmed) cleanedLines.push(trimmed);
      continue;
    }

    // Drop markdown table separator lines (e.g., | --- | --- |)
    if (/^\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed)) {
      continue;
    }

    // Drop horizontal rules
    if (/^(?:[-*_]\s*){3,}$/.test(trimmed)) {
      continue;
    }

    let line = rawLine;

    // Strip HTML comments and tags
    line = line.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');

    // Strip heading markers, blockquote prefixes, and list bullets/numbers
    line = line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*(?:>\s*)+/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');

    // Convert table rows to readable text
    if (line.includes('|') && /^\s*\|/.test(line)) {
      line = line
        .replace(/^\s*\||\|\s*$/g, '')
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(' — ');
    }

    // Convert images and links to visible labels
    line = line
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

    // Remove inline formatting markers while keeping content
    line = line
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1');

    cleanedLines.push(line.trim());
  }

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeInlineSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutoff = lastSpace > maxChars * 0.6 ? lastSpace : maxChars - 1;
  return `${slice.slice(0, cutoff).trimEnd()}…`;
}

function splitIntoChunks(plainText: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => normalizeInlineSpace(paragraph))
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let buffer = '';

  const flush = (): void => {
    if (buffer) {
      chunks.push(buffer);
      buffer = '';
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
      let sentenceBuffer = '';
      for (const sentence of sentences) {
        if (sentence.length > maxChars) {
          if (sentenceBuffer) {
            chunks.push(sentenceBuffer);
            sentenceBuffer = '';
          }
          chunks.push(truncateAtWordBoundary(sentence, maxChars));
          continue;
        }
        const candidate = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
        if (candidate.length <= maxChars) {
          sentenceBuffer = candidate;
        } else {
          if (sentenceBuffer) chunks.push(sentenceBuffer);
          sentenceBuffer = sentence;
        }
      }
      if (sentenceBuffer) chunks.push(sentenceBuffer);
      continue;
    }

    const candidate = buffer ? `${buffer} ${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      buffer = candidate;
    } else {
      flush();
      buffer = paragraph;
    }
  }

  flush();
  return chunks;
}

function splitMarkdownByHeadings(
  body: string,
  renderedHeadings: Array<{ depth: number; slug: string; text: string }>,
): Array<{ section: string; slug?: string; markdown: string }> {
  const tocHeadings = renderedHeadings.filter(
    (heading) => heading.depth === 2 || heading.depth === 3,
  );
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const sections: Array<{ section: string; slug?: string; lines: string[] }> = [];

  let current: { section: string; slug?: string; lines: string[] } = {
    section: 'Overview',
    lines: [],
  };
  let headingIndex = 0;
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      current.lines.push(line);
      continue;
    }

    if (!inCodeFence) {
      const headingMatch = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        sections.push(current);
        const matchedHeading = tocHeadings[headingIndex];
        headingIndex += 1;
        const fallbackTitle = stripMarkdownToPlainText(headingMatch[2]);
        current = {
          section: matchedHeading?.text ?? fallbackTitle,
          slug: matchedHeading?.slug,
          lines: [],
        };
        continue;
      }
    }

    current.lines.push(line);
  }

  sections.push(current);

  return sections.map((entry) => ({
    section: entry.section,
    slug: entry.slug,
    markdown: entry.lines.join('\n').trim(),
  }));
}

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
