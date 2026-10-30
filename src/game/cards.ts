export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type Rank = (typeof RANKS)[number];

/** The Spanish 40-card deck has four copies of every rank (one per suit). */
export const COPIES_PER_RANK = 4;
export const DECK_SIZE = RANKS.length * COPIES_PER_RANK;

export function rankValue(rank: Rank): number {
  return rank >= 10 ? rank - 2 : rank;
}

export function valueToRank(value: number): Rank | null {
  if (value >= 1 && value <= 7) return value as Rank;
  if (value === 8) return 10;
  if (value === 9) return 11;
  if (value === 10) return 12;
  return null;
}

export function isRank(value: number): value is Rank {
  return (RANKS as readonly number[]).includes(value);
}

export function rankLabel(rank: Rank): string {
  return String(rank);
}

export function rankName(rank: Rank): string {
  if (rank === 10) return '10 (Sota)';
  if (rank === 11) return '11 (Caballo)';
  if (rank === 12) return '12 (Rey)';
  return String(rank);
}
