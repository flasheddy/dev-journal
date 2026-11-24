export const MAX_CHUNK_CHARS = 700;

export type RenderedHeading = {
  depth: number;
  slug: string;
  text: string;
};

export type MarkdownSection = {
  section: string;
  slug?: string;
  markdown: string;
};

export function stripMarkdownToPlainText(markdown: string): string {
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

export function normalizeInlineSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutoff = lastSpace > maxChars * 0.6 ? lastSpace : maxChars - 1;
  return `${slice.slice(0, cutoff).trimEnd()}…`;
}

export function splitIntoChunks(plainText: string, maxChars = MAX_CHUNK_CHARS): string[] {
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

export function splitMarkdownByHeadings(
  body: string,
  renderedHeadings: RenderedHeading[],
): MarkdownSection[] {
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
