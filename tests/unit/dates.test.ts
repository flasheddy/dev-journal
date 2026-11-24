import { describe, expect, test } from 'bun:test';
import { formatDate, isUpdated, isoDate } from '../../src/lib/dates';

describe('isoDate', () => {
  test('returns the UTC calendar date', () => {
    expect(isoDate(new Date('2026-09-26T12:00:00Z'))).toBe('2026-09-26');
  });

  test('does not shift the day for a late UTC time', () => {
    expect(isoDate(new Date('2026-09-26T23:59:59.999Z'))).toBe('2026-09-26');
  });
});

describe('formatDate', () => {
  test('formats the short month', () => {
    expect(formatDate(new Date('2026-09-26T12:00:00Z'), 'short')).toBe('Sep 26, 2026');
  });

  test('formats the long month', () => {
    expect(formatDate(new Date('2026-09-26T12:00:00Z'), 'long')).toBe('September 26, 2026');
  });

  test('uses UTC just after the start of the UTC day', () => {
    expect(formatDate(new Date('2026-09-26T00:30:00Z'), 'short')).toBe('Sep 26, 2026');
  });

  test('uses UTC just before the end of the UTC day', () => {
    expect(formatDate(new Date('2026-09-26T23:30:00Z'), 'short')).toBe('Sep 26, 2026');
  });
});

describe('isUpdated', () => {
  const date = new Date('2026-09-26T12:00:00Z');

  test('is false when updated is missing', () => {
    expect(isUpdated({ data: { date } })).toBe(false);
  });

  test('is false when updated equals date', () => {
    expect(isUpdated({ data: { date, updated: new Date(date) } })).toBe(false);
  });

  test('is true when the dates differ', () => {
    expect(isUpdated({ data: { date, updated: new Date('2026-10-01T12:00:00Z') } })).toBe(true);
  });
});
