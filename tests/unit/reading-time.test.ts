import { describe, expect, test } from 'bun:test';
import { readingTime } from '../../src/lib/reading-time';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

describe('readingTime', () => {
  test('rounds up at the 238-word boundary', () => {
    expect(readingTime(words(238))).toBe(1);
    expect(readingTime(words(239))).toBe(2);
  });

  test('excludes fenced code blocks from the prose count', () => {
    const fence = `\n\n\`\`\`ts\n${words(1000)}\n\`\`\`\n\n`;

    expect(readingTime(`${words(238)}${fence}`)).toBe(1);
    expect(readingTime(`${words(100)}${fence}${words(100)}${fence}${words(100)}`)).toBe(2);
  });
});
