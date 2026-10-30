export const SUITS = ['oros', 'copas', 'espadas', 'bastos'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type CardKey = `${Suit}-${Rank}`;

export const SUIT_LABEL: Record<Suit, string> = {
  oros: 'Oros',
  copas: 'Copas',
  espadas: 'Espadas',
  bastos: 'Bastos'
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  oros: '◉',
  copas: '♥',
  espadas: '⚔',
  bastos: '♣'
};

export const RANK_LABEL: Record<Rank, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  10: '10',
  11: '11',
  12: '12'
};

export const RANK_FACE: Partial<Record<Rank, string>> = {
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey'
};

/** Game value: 1-7 face value, 10 -> 8, 11 -> 9, 12 -> 10. */
export function rankValue(r: Rank): number {
  return r >= 10 ? r - 2 : r;
}

export function cardValue(c: Card): number {
  return rankValue(c.rank);
}

/** Maps a numeric value back to the only rank that can produce it. */
export function valueToRank(v: number): Rank | null {
  if (v >= 1 && v <= 7) return v as Rank;
  if (v === 8) return 10;
  if (v === 9) return 11;
  if (v === 10) return 12;
  return null;
}

export function isRank(n: number): n is Rank {
  return (RANKS as readonly number[]).includes(n);
}

export function isSuit(s: string): s is Suit {
  return (SUITS as readonly string[]).includes(s);
}

export function cardKey(c: Card): CardKey {
  return `${c.suit}-${c.rank}`;
}

export function cardFromKey(key: string): Card {
  const [suit, rank] = key.split('-');
  if (!isSuit(suit) || !isRank(Number(rank))) throw new Error(`Invalid card key: ${key}`);
  return { suit, rank: Number(rank) as Rank };
}

export const ALL_CARDS: Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));

export const DECK_KEYS: CardKey[] = ALL_CARDS.map(cardKey);

export function cardName(c: Card): string {
  return `${c.rank} de ${SUIT_LABEL[c.suit]}`;
}

export function cardShort(c: Card): string {
  return `${c.rank}${SUIT_SYMBOL[c.suit]}`;
}
