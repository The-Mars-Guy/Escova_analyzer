import { Card, Rank, cardKey, cardName, cardValue, rankValue } from './cards';

export type EntryKind = 'exact' | 'rank' | 'unknown';

export interface ExactEntry {
  id: string;
  kind: 'exact';
  card: Card;
}

export interface RankEntry {
  id: string;
  kind: 'rank';
  rank: Rank;
}

export interface UnknownEntry {
  id: string;
  kind: 'unknown';
}

export type Entry = ExactEntry | RankEntry | UnknownEntry;

let counter = 0;

export function newEntryId(prefix = 'e'): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  counter += 1;
  return `${prefix}${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function exactEntry(card: Card, id = newEntryId('c')): ExactEntry {
  return { id, kind: 'exact', card };
}

export function rankEntry(rank: Rank, id = newEntryId('r')): RankEntry {
  return { id, kind: 'rank', rank };
}

export function unknownEntry(id = newEntryId('u')): UnknownEntry {
  return { id, kind: 'unknown' };
}

export function entryValue(e: Entry): number | null {
  if (e.kind === 'exact') return cardValue(e.card);
  if (e.kind === 'rank') return rankValue(e.rank);
  return null;
}

export function entryCard(e: Entry): Card | null {
  return e.kind === 'exact' ? e.card : null;
}

export function entryKey(e: Entry): string {
  return e.kind === 'exact' ? cardKey(e.card) : `${e.kind}-${e.id}`;
}

export function entryLabel(e: Entry): string {
  if (e.kind === 'exact') return cardName(e.card);
  if (e.kind === 'rank') return `Rank ${e.rank} (suit unknown)`;
  return 'Unknown card';
}

export function entryShort(e: Entry): string {
  if (e.kind === 'exact') return `${e.card.rank}`;
  if (e.kind === 'rank') return `${e.rank}?`;
  return '?';
}

export function isKnownValue(e: Entry): boolean {
  return e.kind !== 'unknown';
}

export function sameEntry(a: Entry, b: Entry): boolean {
  return a.id === b.id;
}
