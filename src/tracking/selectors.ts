import { COPIES_PER_RANK, DECK_SIZE, RANKS, Rank } from '../game/cards';
import { Entry, entryValue } from '../game/entries';
import {
  Game,
  Player,
  allEntries,
  deadRankCounts,
  expectedPlaysThisDeal,
  playsThisDeal,
  rankEntryCounts
} from './state';

export { allEntries };

export function openEntries(g: Game): Entry[] {
  return allEntries(g).filter((e) => e.kind === 'unknown');
}

export function remainingRankCopies(g: Game): Map<Rank, number> {
  const entries = rankEntryCounts(g);
  const dead = deadRankCounts(g);
  const result = new Map<Rank, number>();
  for (const rank of RANKS) {
    const used = (entries.get(rank) ?? 0) + (dead.get(rank) ?? 0);
    result.set(rank, Math.max(0, COPIES_PER_RANK - used));
  }
  return result;
}

export function remainingRankCount(g: Game, rank: Rank): number {
  return remainingRankCopies(g).get(rank) ?? 0;
}

export function accountedCardCount(g: Game): number {
  return allEntries(g).length + g.deadRanks.length;
}

export function unseenCount(g: Game): number {
  return Math.max(0, DECK_SIZE - accountedCardCount(g));
}

export function informationPercent(g: Game): number {
  return Math.round((accountedCardCount(g) / DECK_SIZE) * 100);
}

export function opponentHandSizes(g: Game): [number, number] {
  const expected = expectedPlaysThisDeal(g);
  const sizeFor = (player: Player) => Math.max(0, expected - playsThisDeal(g, player));
  return [sizeFor(1), sizeFor(2)];
}

export function myHandValues(g: Game): { entry: Entry; value: number }[] {
  const result: { entry: Entry; value: number }[] = [];
  for (const entry of g.hand) {
    const value = entryValue(entry);
    if (value !== null) result.push({ entry, value });
  }
  return result;
}

export function capturedCounts(g: Game): { cards: number[]; unknown: number[] } {
  return {
    cards: g.captured.map((pile) => pile.length),
    unknown: g.captured.map((pile) => pile.filter((e) => e.kind === 'unknown').length)
  };
}
