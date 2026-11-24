import { describe, expect, test } from 'bun:test';
import { readingTime } from '../../src/lib/reading-time';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

describe('readingTime', () => {
  test('returns 1 for empty content', () => {
    expect(readingTime('')).toBe(1);
  });

  test('returns 1 for one word', () => {
    expect(readingTime('word')).toBe(1);
  });

  test('returns 1 for 238 words', () => {
    expect(readingTime(words(238))).toBe(1);
  });

  test('returns 2 for 239 words', () => {
    expect(readingTime(words(239))).toBe(2);
  });

  test('excludes a fenced code block from the prose count', () => {
    const content = `${words(238)}\n\n\`\`\`ts\n${words(1000)}\n\`\`\`\n`;
    expect(readingTime(content)).toBe(1);
  });

  test('excludes multiple fenced code blocks from the prose count', () => {
    const fence = `\n\n\`\`\`ts\n${words(1000)}\n\`\`\`\n\n`;
    const content = `${words(100)}${fence}${words(100)}${fence}${words(100)}`;
    expect(readingTime(content)).toBe(2);
  });
});
