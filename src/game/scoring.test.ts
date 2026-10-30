import { describe, expect, it } from 'vitest';
import { HOUSE_CONFIG } from './config';
import { exactEntry, rankEntry } from './entries';
import { scoreRound, seventyScore } from './scoring';
import { Rank, Suit } from './cards';

const pile = (cards: [Suit, Rank][]) => cards.map(([suit, rank]) => exactEntry({ suit, rank }));

describe('scoring', () => {
  it('awards majorities, seven of oros and escobas', () => {
    const captured = [
      [...pile([['oros', 7], ['oros', 1], ['copas', 7]]), ...pile([['oros', 4], ['oros', 5]])],
      pile([['copas', 2], ['espadas', 7]]),
      pile([['bastos', 3]])
    ];
    const result = scoreRound({
      captured,
      sweeps: [2, 0, 0],
      handBonus: [1, 0, 0],
      priorScores: [5, 0, 0],
      config: { ...HOUSE_CONFIG, handEscova: 3, escoba: 1, mostCards: 1, mostOros: 1, mostSevens: 1, sevenOfOros: 1 }
    });
    const you = result.players[0];
    expect(you.cards).toBe(5);
    expect(you.oros).toBe(4);
    expect(you.sevens).toBe(2);
    expect(you.hasSevenOfOros).toBe(true);
    expect(you.lines.map((l) => l.label)).toEqual(
      expect.arrayContaining([
        'Escobas ×2',
        'Hand escova ×1',
        'Most cards',
        'Most oros',
        'Most sevens',
        '7 de oros'
      ])
    );
    expect(you.roundPoints).toBe(2 + 3 + 1 + 1 + 1 + 1);
    expect(you.totalPoints).toBe(14);
  });

  it('awards nothing for a tied category unless configured', () => {
    const captured = [
      pile([['oros', 1], ['oros', 2]]),
      pile([['oros', 3], ['oros', 4]]),
      pile([['bastos', 5]])
    ];
    const tied = scoreRound({
      captured,
      sweeps: [0, 0, 0],
      handBonus: [0, 0, 0],
      priorScores: [0, 0, 0],
      config: { ...HOUSE_CONFIG, mostCards: 1, mostOros: 1, awardTies: false }
    });
    expect(tied.players[0].lines.some((l) => l.label === 'Most cards')).toBe(false);
    expect(tied.players[1].lines.some((l) => l.label === 'Most cards')).toBe(false);
    expect(tied.players[1].lines.some((l) => l.label === 'Most oros')).toBe(false);
  });

  it('computes la setenta only with all four suits', () => {
    const fourSuits = pile([
      ['oros', 7],
      ['copas', 6],
      ['espadas', 5],
      ['bastos', 4]
    ]);
    expect(seventyScore(fourSuits)).toBe(7 + 6 + 5 + 4);
    expect(seventyScore(pile([['oros', 7], ['copas', 6], ['espadas', 5]]))).toBe(0);
  });

  it('flags unknown captured cards as uncertain', () => {
    const result = scoreRound({
      captured: [[rankEntry(5)], [], []],
      sweeps: [0, 0, 0],
      handBonus: [0, 0, 0],
      priorScores: [0, 0, 0],
      config: HOUSE_CONFIG
    });
    expect(result.uncertain).toBe(true);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
