import { describe, expect, it } from 'vitest';
import { ALL_CARDS, Card, RANKS, SUITS, cardValue, rankValue, valueToRank } from './cards';
import { exactEntry, unknownEntry } from './entries';
import { anyCaptureAvailable, isSweep, legalCaptures, tableSum } from './rules';

const card = (suit: (typeof SUITS)[number], rank: (typeof RANKS)[number]): Card => ({ suit, rank });
const entry = (suit: (typeof SUITS)[number], rank: (typeof RANKS)[number]) => exactEntry(card(suit, rank));

describe('deck', () => {
  it('has 40 cards with no eights or nines', () => {
    expect(ALL_CARDS).toHaveLength(40);
    expect(ALL_CARDS.some((c) => (c.rank as number) === 8 || (c.rank as number) === 9)).toBe(false);
  });

  it('maps face values correctly', () => {
    expect(rankValue(1)).toBe(1);
    expect(rankValue(7)).toBe(7);
    expect(rankValue(10)).toBe(8);
    expect(rankValue(11)).toBe(9);
    expect(rankValue(12)).toBe(10);
    expect(cardValue(card('oros', 12))).toBe(10);
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
    const table = [entry('oros', 10), entry('copas', 3), entry('espadas', 5)];
    const singles = legalCaptures(table, 7).filter((c) => c.length === 1);
    const doubles = legalCaptures(table, 7).filter((c) => c.length === 2);
    expect(singles).toHaveLength(1);
    expect(singles[0][0].id).toBe(table[0].id);
    expect(doubles).toHaveLength(1);
  });

  it('excludes unknown table cards from captures', () => {
    const unknown = unknownEntry();
    const table = [entry('oros', 10), unknown];
    const captures = legalCaptures(table, 7);
    expect(captures).toHaveLength(1);
    expect(captures[0]).toHaveLength(1);
  });

  it('detects a table-clearing escova only when every card is captured', () => {
    const table = [entry('oros', 4), entry('copas', 1)];
    const capture = legalCaptures(table, 10);
    expect(capture).toHaveLength(1);
    expect(isSweep(table, capture[0])).toBe(true);

    const withUnknown = [...table, unknownEntry()];
    const partial = legalCaptures(withUnknown, 10);
    expect(partial.every((c) => !isSweep(withUnknown, c))).toBe(true);
  });

  it('reports captures available across the hand', () => {
    const table = [entry('oros', 10)];
    expect(anyCaptureAvailable([entry('copas', 7)], table)).toBe(true);
    expect(anyCaptureAvailable([entry('copas', 2)], table)).toBe(false);
  });

  it('sums a fully known table', () => {
    expect(tableSum([entry('oros', 10), entry('copas', 7)])).toBe(15);
    expect(tableSum([entry('oros', 10), unknownEntry()])).toBeNull();
  });
});
