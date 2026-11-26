import { describe, expect, it } from 'vitest';
import { rangeBounds, rangeLabel } from './dates.js';

describe('dashboard ranges', () => {
  it('bounds a calendar month', () => {
    expect(rangeBounds('month', 2026, 11)).toEqual({ start: '2026-11-01', end: '2026-12-01' });
  });

  it('bounds the quarter that contains the month', () => {
    expect(rangeBounds('quarter', 2026, 2)).toEqual({ start: '2026-01-01', end: '2026-04-01' });
    expect(rangeBounds('quarter', 2026, 11)).toEqual({ start: '2026-10-01', end: '2027-01-01' });
  });

  it('bounds a calendar year', () => {
    expect(rangeBounds('year', 2026, 11)).toEqual({ start: '2026-01-01', end: '2027-01-01' });
    expect(rangeLabel('quarter', 2026, 11)).toBe('רבעון 4 2026');
  });
});
