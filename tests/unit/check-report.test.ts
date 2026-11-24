import { describe, expect, test } from 'bun:test';
import { report } from '../../scripts/check/report';

describe('report', () => {
  test('prints every failure and exits with 1', () => {
    const messages: string[] = [];
    const exitCodes: number[] = [];
    const originalError = console.error;
    console.error = (message?: unknown) => {
      messages.push(String(message));
    };

    try {
      report(['first failure', 'second failure'], (code) => {
        exitCodes.push(code);
      });
    } finally {
      console.error = originalError;
    }

    expect(messages).toEqual(['FAIL: first failure', 'FAIL: second failure']);
    expect(exitCodes).toEqual([1]);
  });

  test('does not exit when there are no errors', () => {
    const exitCodes: number[] = [];

    report([], (code) => {
      exitCodes.push(code);
    });

    expect(exitCodes).toEqual([]);
  });
});
