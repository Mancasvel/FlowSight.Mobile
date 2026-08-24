import { describe, test, expect } from 'vitest';
/**
 * Format utilities — Unit tests.
 */

import {
  formatDuration,
  formatDurationShort,
  getTodayDate,
  getWeekStartDate,
  formatPercent,
} from '../../src/utils/format';

describe('formatDuration', () => {
  test('formats 0 seconds', () => { expect(formatDuration(0)).toBe('00:00:00'); });
  test('formats seconds only', () => { expect(formatDuration(45)).toBe('00:00:45'); });
  test('formats minutes and seconds', () => { expect(formatDuration(125)).toBe('00:02:05'); });
  test('formats hours, minutes, seconds', () => { expect(formatDuration(3661)).toBe('01:01:01'); });
  test('formats large values', () => { expect(formatDuration(36000)).toBe('10:00:00'); });
});

describe('formatDurationShort', () => {
  test('formats minutes only', () => { expect(formatDurationShort(900)).toBe('15m'); });
  test('formats hours only', () => { expect(formatDurationShort(3600)).toBe('1h'); });
  test('formats hours and minutes', () => { expect(formatDurationShort(5400)).toBe('1h 30m'); });
  test('formats 0', () => { expect(formatDurationShort(0)).toBe('0m'); });
});

describe('getTodayDate', () => {
  test('returns YYYY-MM-DD format', () => {
    expect(getTodayDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatPercent', () => {
  test('formats integer', () => { expect(formatPercent(75)).toBe('75%'); });
  test('rounds decimal', () => { expect(formatPercent(75.6)).toBe('76%'); });
  test('formats 0', () => { expect(formatPercent(0)).toBe('0%'); });
  test('formats 100', () => { expect(formatPercent(100)).toBe('100%'); });
});
