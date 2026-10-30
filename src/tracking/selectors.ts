import { ALL_CARDS, Card, CardKey, cardKey } from '../game/cards';
import { Entry, entryValue } from '../game/entries';
import { Game, Player, expectedPlaysThisDeal, playsThisDeal, usedExactKeys } from './state';

export function allEntries(g: Game): Entry[] {
  return [...g.hand, ...g.table, ...g.captured.flat()];
}

export function openEntries(g: Game): Entry[] {
  return allEntries(g).filter((e) => e.kind !== 'exact');
}

export function unseenCards(g: Game): Card[] {
  const used = usedExactKeys(g);
  const dead = new Set(g.deadCards);
  return ALL_CARDS.filter((c) => {
    const key = cardKey(c);
    return !used.has(key) && !dead.has(key);
  });
}

export function accountedCardCount(g: Game): number {
  return usedExactKeys(g).size + openEntries(g).length + g.deadCards.length;
}

export function unseenCount(g: Game): number {
  return Math.max(0, 40 - accountedCardCount(g));
}

export function opponentHandSizes(g: Game): [number, number] {
  const expected = expectedPlaysThisDeal(g);
  const sizeFor = (p: Player) => Math.max(0, expected - playsThisDeal(g, p));
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

export function informationPercent(g: Game): number {
  const resolved = usedExactKeys(g).size + g.deadCards.length;
  return Math.round((resolved / 40) * 100);
}

export function deadCardSet(g: Game): Set<CardKey> {
  return new Set(g.deadCards);
}

export function capturedCounts(g: Game): { cards: number[]; oros: number[]; sevens: number[] } {
  return {
    cards: g.captured.map((pile) => pile.length),
    oros: g.captured.map(
      (pile) => pile.filter((e) => e.kind === 'exact' && e.card.suit === 'oros').length
    ),
    sevens: g.captured.map(
      (pile) => pile.filter((e) => e.kind === 'exact' && e.card.rank === 7).length
    )
  };
}
