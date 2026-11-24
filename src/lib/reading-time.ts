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
