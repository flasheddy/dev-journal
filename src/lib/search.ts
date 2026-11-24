import type { AiCorpusChunk, SearchIndexItem } from './contracts';

export function rankSearchItems(
  items: readonly SearchIndexItem[],
  query: string,
): SearchIndexItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...items];

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: SearchIndexItem; score: number; index: number }> = [];

  items.forEach((item, index) => {
    const titleLower = item.title.toLowerCase();
    const summaryLower = item.summary.toLowerCase();
    const tagsLower = item.tags.map((tag) => tag.toLowerCase());
    const kindLower = item.kind;

    let score = 0;
    for (const token of tokens) {
      let tokenScore = 0;
      if (titleLower.startsWith(token)) {
        tokenScore += 34;
      } else if (titleLower.includes(` ${token}`) || titleLower.includes(`-${token}`)) {
        tokenScore += 28;
      } else if (titleLower.includes(token)) {
        tokenScore += 20;
      }

      if (tagsLower.some((tag) => tag === token)) {
        tokenScore += 24;
      } else if (tagsLower.some((tag) => tag.startsWith(token))) {
        tokenScore += 18;
      } else if (tagsLower.some((tag) => tag.includes(token))) {
        tokenScore += 12;
      }

      if (summaryLower.includes(token)) {
        tokenScore += 6;
      }

      if (kindLower.startsWith(token)) {
        tokenScore += 5;
      }

      if (tokenScore === 0) return;
      score += tokenScore;
    }

    if (titleLower.startsWith(normalizedQuery)) {
      score += 120;
    } else if (titleLower.includes(normalizedQuery)) {
      score += 80;
    }

    if (tagsLower.some((tag) => tag === normalizedQuery)) {
      score += 70;
    }

    scored.push({ item, score, index });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.item);
}

const askStopWords = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
]);

export function tokenizeQuestion(question: string): string[] {
  const raw = question
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
  const meaningful = raw.filter((token) => !askStopWords.has(token));
  const tokens = meaningful.length > 0 ? meaningful : raw;
  return [...new Set(tokens)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rankCorpusChunks(
  chunks: readonly AiCorpusChunk[],
  question: string,
  limit = 3,
): AiCorpusChunk[] {
  const normalizedQuery = question.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const tokens = tokenizeQuestion(normalizedQuery);
  if (tokens.length === 0) return [];

  const scored: Array<{ chunk: AiCorpusChunk; score: number; index: number }> = [];

  chunks.forEach((chunk, index) => {
    const titleLower = chunk.title.toLowerCase();
    const sectionLower = chunk.section.toLowerCase();
    const textLower = chunk.text.toLowerCase();
    const tagsLower = chunk.tags.map((tag) => tag.toLowerCase());

    let score = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      let tokenScore = 0;
      const wordPattern = new RegExp(`\\b${escapeRegExp(token)}`, 'g');

      if (titleLower.includes(token)) {
        tokenScore += wordPattern.test(titleLower) ? 18 : 11;
      }
      wordPattern.lastIndex = 0;

      if (sectionLower.includes(token)) {
        tokenScore += wordPattern.test(sectionLower) ? 20 : 12;
      }
      wordPattern.lastIndex = 0;

      if (tagsLower.some((tag) => tag === token)) {
        tokenScore += 22;
      } else if (tagsLower.some((tag) => tag.includes(token))) {
        tokenScore += 14;
      }

      const textMatches = textLower.match(wordPattern);
      if (textMatches && textMatches.length > 0) {
        tokenScore += Math.min(textMatches.length, 4) * 7;
      } else if (token.length >= 4 && textLower.includes(token)) {
        tokenScore += 4;
      }

      if (tokenScore > 0) {
        matchedTokens += 1;
        score += tokenScore;
      }
    }

    if (matchedTokens === 0) return;

    // Reward multi-token coverage across a chunk.
    score += (matchedTokens / tokens.length) * 30;

    if (normalizedQuery.length >= 4) {
      if (sectionLower.includes(normalizedQuery)) score += 40;
      if (titleLower.includes(normalizedQuery)) score += 32;
      if (textLower.includes(normalizedQuery)) score += 26;
    }

    scored.push({ chunk, score, index });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  // Prefer distinct URLs when available so citations cover complementary sections.
  const selected: AiCorpusChunk[] = [];
  const seenUrls = new Set<string>();
  for (const entry of scored) {
    if (selected.length >= limit) break;
    if (seenUrls.has(entry.chunk.url)) continue;
    seenUrls.add(entry.chunk.url);
    selected.push(entry.chunk);
  }
  if (selected.length < limit) {
    for (const entry of scored) {
      if (selected.length >= limit) break;
      if (selected.includes(entry.chunk)) continue;
      selected.push(entry.chunk);
    }
  }

  return selected;
}

export function summarizeExcerpt(text: string, maxChars = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutoff = lastSpace > maxChars * 0.6 ? lastSpace : maxChars - 1;
  return `${slice.slice(0, cutoff).trimEnd()}…`;
}

export function isSafeChunkUrl(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  return /^https?:\/\//i.test(url);
}
