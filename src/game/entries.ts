import { Rank, rankName, rankValue } from './cards';

export type EntryKind = 'rank' | 'unknown';

export interface RankEntry {
  id: string;
  kind: 'rank';
  rank: Rank;
}

export interface UnknownEntry {
  id: string;
  kind: 'unknown';
}

export type Entry = RankEntry | UnknownEntry;

let counter = 0;

export function newEntryId(prefix = 'e'): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  counter += 1;
  return `${prefix}${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function rankEntry(rank: Rank, id = newEntryId('r')): RankEntry {
  return { id, kind: 'rank', rank };
}

export function unknownEntry(id = newEntryId('u')): UnknownEntry {
  return { id, kind: 'unknown' };
}

export function entryValue(entry: Entry): number | null {
  return entry.kind === 'rank' ? rankValue(entry.rank) : null;
}

export function entryRank(entry: Entry): Rank | null {
  return entry.kind === 'rank' ? entry.rank : null;
}

export function entryLabel(entry: Entry): string {
  return entry.kind === 'rank' ? rankName(entry.rank) : 'Unknown card';
}

export function entryShort(entry: Entry): string {
  return entry.kind === 'rank' ? String(entry.rank) : '0';
}
