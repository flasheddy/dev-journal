import { describe, expect, test } from 'bun:test';
import { formatDate, isUpdated, isoDate } from '../../src/lib/dates';

describe('UTC date handling', () => {
  test('keeps the UTC calendar date at both ends of the day', () => {
    expect(isoDate(new Date('2026-09-26T00:00:00.000Z'))).toBe('2026-09-26');
    expect(isoDate(new Date('2026-09-26T23:59:59.999Z'))).toBe('2026-09-26');
  });

  test('formats the UTC date at both ends of the day', () => {
    expect(formatDate(new Date('2026-09-26T00:30:00Z'))).toBe('Sep 26, 2026');
    expect(formatDate(new Date('2026-09-26T23:30:00Z'))).toBe('Sep 26, 2026');
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
