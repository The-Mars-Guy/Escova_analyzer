import { describe, expect, it } from 'vitest';
import { COPIES_PER_RANK, DECK_SIZE, RANKS, rankValue, valueToRank } from './cards';
import { rankEntry, unknownEntry } from './entries';
import { anyCaptureAvailable, isSweep, legalCaptures, tableSum } from './rules';

describe('deck', () => {
  it('models 10 ranks with four copies each, no 8s or 9s', () => {
    expect(RANKS).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
    expect(COPIES_PER_RANK).toBe(4);
    expect(DECK_SIZE).toBe(40);
  });

  it('maps face values correctly', () => {
    expect(rankValue(1)).toBe(1);
    expect(rankValue(7)).toBe(7);
    expect(rankValue(10)).toBe(8);
    expect(rankValue(11)).toBe(9);
    expect(rankValue(12)).toBe(10);
  });

  it('maps values back to ranks without inventing a suit', () => {
    expect(valueToRank(5)).toBe(5);
    expect(valueToRank(8)).toBe(10);
    expect(valueToRank(9)).toBe(11);
    expect(valueToRank(10)).toBe(12);
    expect(valueToRank(0)).toBeNull();
    expect(valueToRank(11)).toBeNull();
  });
});

describe('legal captures', () => {
  it('finds single and multi-card captures', () => {
    const table = [rankEntry(10), rankEntry(3), rankEntry(5)];
    const singles = legalCaptures(table, 7).filter((c) => c.length === 1);
    const doubles = legalCaptures(table, 7).filter((c) => c.length === 2);
    expect(singles).toHaveLength(1);
    expect(singles[0][0].id).toBe(table[0].id);
    expect(doubles).toHaveLength(1);
  });

  it('excludes unknown table cards from captures', () => {
    const unknown = unknownEntry();
    const table = [rankEntry(10), unknown];
    const captures = legalCaptures(table, 7);
    expect(captures).toHaveLength(1);
    expect(captures[0]).toHaveLength(1);
  });

  it('detects a table-clearing escova only when every card is captured', () => {
    const table = [rankEntry(4), rankEntry(1)];
    const capture = legalCaptures(table, 10);
    expect(capture).toHaveLength(1);
    expect(isSweep(table, capture[0])).toBe(true);

    const withUnknown = [...table, unknownEntry()];
    const partial = legalCaptures(withUnknown, 10);
    expect(partial.every((c) => !isSweep(withUnknown, c))).toBe(true);
  });

  it('reports captures available across the hand', () => {
    const table = [rankEntry(10)];
    expect(anyCaptureAvailable([rankEntry(7)], table)).toBe(true);
    expect(anyCaptureAvailable([rankEntry(2)], table)).toBe(false);
  });

  it('sums a fully known table', () => {
    expect(tableSum([rankEntry(10), rankEntry(7)])).toBe(15);
    expect(tableSum([rankEntry(10), unknownEntry()])).toBeNull();
  });
});
