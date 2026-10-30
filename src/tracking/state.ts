import { COPIES_PER_RANK, DECK_SIZE, Rank, isRank, valueToRank } from '../game/cards';
import { Entry, entryValue, rankEntry, unknownEntry } from '../game/entries';
import { anyCaptureAvailable, isSameCapture, isSweep, legalCaptures, tableSum } from '../game/rules';

export type Player = 0 | 1 | 2;
export const PLAYERS: Player[] = [0, 1, 2];

export interface TurnRecord {
  player: Player;
  played: Entry;
  captured: Entry[];
  sweep: boolean;
  deal: number;
  inferredValue: number | null;
}

export interface Game {
  version: 3;
  id: string;
  phase: 'setup' | 'playing' | 'finished';
  deal: number;
  turn: Player;
  hand: Entry[];
  table: Entry[];
  captured: Entry[][];
  sweeps: number[];
  turns: TurnRecord[];
  lastCapture: Player | null;
  unknownDiscards: number;
  midRound: boolean;
  opponentStartHand: number;
  startDeal: number;
  claimedInitial: boolean;
  deadRanks: Rank[];
  createdAt: number;
  updatedAt: number;
}

export type PlayedInput =
  | { kind: 'rank'; rank: Rank }
  | { kind: 'unknown' };

let gameCounter = 0;

function gameId(): string {
  gameCounter += 1;
  return `g${Date.now().toString(36)}-${gameCounter.toString(36)}`;
}

export function initialGame(overrides: Partial<Game> = {}): Game {
  const now = Date.now();
  return {
    version: 3,
    id: gameId(),
    phase: 'setup',
    deal: 1,
    turn: 0,
    hand: [],
    table: [],
    captured: [[], [], []],
    sweeps: [0, 0, 0],
    turns: [],
    lastCapture: null,
    unknownDiscards: 0,
    midRound: false,
    opponentStartHand: 3,
    startDeal: 1,
    claimedInitial: false,
    deadRanks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function touch(g: Game): Game {
  return { ...g, updatedAt: Date.now() };
}

export function allEntries(g: Game): Entry[] {
  return [...g.hand, ...g.table, ...g.captured.flat()];
}

/** Number of known copies of every rank that are in hands, on the table or captured. */
export function rankEntryCounts(g: Game): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const entry of allEntries(g)) {
    if (entry.kind === 'rank') counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  }
  return counts;
}

export function deadRankCounts(g: Game): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const rank of g.deadRanks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  return counts;
}

export function usedRankCount(g: Game, rank: Rank): number {
  return (rankEntryCounts(g).get(rank) ?? 0) + (deadRankCounts(g).get(rank) ?? 0);
}

export function remainingRankCount(g: Game, rank: Rank): number {
  return Math.max(0, COPIES_PER_RANK - usedRankCount(g, rank));
}

function assertRankAvailable(g: Game, rank: Rank, exceptEntryId?: string): void {
  if (!isRank(rank)) throw new Error('Invalid rank.');
  let used = deadRankCounts(g).get(rank) ?? 0;
  for (const entry of allEntries(g)) {
    if (entry.id === exceptEntryId) continue;
    if (entry.kind === 'rank' && entry.rank === rank) used += 1;
  }
  if (used >= COPIES_PER_RANK) {
    throw new Error(`All four copies of rank ${rank} are already accounted for.`);
  }
}

export function accountedTotal(g: Game): number {
  return allEntries(g).length + g.deadRanks.length;
}

function assertDeckSpace(g: Game): void {
  if (accountedTotal(g) >= DECK_SIZE) throw new Error('All 40 cards are already accounted for.');
}

export function addRankCard(g: Game, zone: 'hand' | 'table', rank: Rank): Game {
  if (g.phase === 'finished') throw new Error('The game is finished.');
  if (zone === 'table' && g.phase !== 'setup') {
    throw new Error('Table cards can only be edited during setup.');
  }
  if (zone === 'hand') {
    if (g.hand.length >= 3) throw new Error('Your hand already has three cards.');
    if (g.phase === 'playing' && playsThisDeal(g, 0) > 0) {
      throw new Error('Enter the next hand after starting the next deal.');
    }
  }
  assertDeckSpace(g);
  assertRankAvailable(g, rank);
  const entry = rankEntry(rank);
  return touch(
    zone === 'hand' ? { ...g, hand: [...g.hand, entry] } : { ...g, table: [...g.table, entry] }
  );
}

export function addUnknownToTable(g: Game): Game {
  if (g.phase !== 'setup') throw new Error('Unknown table cards can only be added during setup.');
  if (accountedTotal(g) >= DECK_SIZE) throw new Error('All 40 cards are already accounted for.');
  return touch({ ...g, table: [...g.table, unknownEntry()] });
}

export function removeEntry(g: Game, id: string): Game {
  if (g.phase === 'finished') throw new Error('The game is finished.');
  const strip = (list: Entry[]) => list.filter((e) => e.id !== id);
  return touch({
    ...g,
    hand: strip(g.hand),
    table: strip(g.table),
    captured: g.captured.map((pile) => strip(pile))
  });
}

/** Replaces an unknown entry (or corrects a known rank) once more information is available. */
export function resolveEntry(g: Game, id: string, rank: Rank): Game {
  const target = allEntries(g).find((e) => e.id === id);
  if (!target) throw new Error('Entry not found.');
  if (target.kind === 'rank' && target.rank === rank) return g;
  assertRankAvailable(g, rank, id);
  const replacement = rankEntry(rank, id);
  const mapList = (list: Entry[]) => list.map((e) => (e.id === id ? replacement : e));
  return touch({
    ...g,
    hand: mapList(g.hand),
    table: mapList(g.table),
    captured: g.captured.map(mapList),
    turns: g.turns.map((t) => ({
      ...t,
      played: t.played.id === id ? replacement : t.played,
      captured: t.captured.map((e) => (e.id === id ? replacement : e))
    }))
  });
}

export function setTurn(g: Game, turn: Player): Game {
  if (g.phase === 'finished') throw new Error('The game is finished.');
  return touch({ ...g, turn });
}

export function setDeal(g: Game, deal: number): Game {
  if (deal < 1 || deal > 4) throw new Error('Deal must be between 1 and 4.');
  return touch({ ...g, deal });
}

export function setMidRound(g: Game, midRound: boolean): Game {
  return touch({ ...g, midRound });
}

export function setOpponentStartHand(g: Game, n: number): Game {
  const clamped = Math.max(0, Math.min(3, Math.round(n)));
  return touch({ ...g, opponentStartHand: clamped });
}

export function markRankSeen(g: Game, rank: Rank): Game {
  assertDeckSpace(g);
  if (usedRankCount(g, rank) >= COPIES_PER_RANK) {
    throw new Error(`All four copies of rank ${rank} are accounted for.`);
  }
  return touch({ ...g, deadRanks: [...g.deadRanks, rank] });
}

export function unmarkRankSeen(g: Game, rank: Rank): Game {
  const index = g.deadRanks.lastIndexOf(rank);
  if (index < 0) throw new Error('No seen copy of that rank to undo.');
  const deadRanks = [...g.deadRanks];
  deadRanks.splice(index, 1);
  return touch({ ...g, deadRanks });
}

export function handTotal(hand: Entry[]): number | null {
  let total = 0;
  for (const entry of hand) {
    const value = entryValue(entry);
    if (value === null) return null;
    total += value;
  }
  return total;
}

export function isThreeCardEscova(hand: Entry[]): boolean {
  return hand.length === 3 && handTotal(hand) === 15;
}

export function startGame(g: Game): Game {
  if (g.phase !== 'setup') throw new Error('The game has already started.');
  if (g.midRound) {
    if (g.hand.length > 3) throw new Error('A hand cannot have more than three cards.');
  } else {
    const validTable = g.table.length === 4 || (g.claimedInitial && g.table.length === 0);
    if (!validTable) throw new Error('Enter exactly four table cards.');
    if (g.hand.length !== 3) throw new Error('Enter exactly three hand cards.');
  }
  return touch({ ...g, phase: 'playing', startDeal: g.deal, updatedAt: Date.now() });
}

/** Official rule: four opening table cards totalling 15 go to the dealer as an escoba. */
export function claimInitialEscova(g: Game, player: Player): Game {
  if (g.phase !== 'setup') throw new Error('The game has already started.');
  if (g.midRound) throw new Error('This rule applies to a fresh deal.');
  if (g.table.length !== 4) throw new Error('Four table cards are required.');
  if (tableSum(g.table) !== 15) throw new Error('The table cards do not total 15.');
  return touch({
    ...g,
    captured: g.captured.map((pile, i) => (i === player ? [...pile, ...g.table] : pile)),
    sweeps: g.sweeps.map((n, i) => (i === player ? n + 1 : n)),
    table: [],
    lastCapture: player,
    claimedInitial: true
  });
}

export function playCard(g: Game, entryId: string, captureIds: string[]): Game {
  if (g.phase !== 'playing') throw new Error('The game is not in play.');
  if (g.turn !== 0) throw new Error('It is not your turn.');
  const entry = g.hand.find((e) => e.id === entryId);
  if (!entry) throw new Error('That card is not in your hand.');
  const playedValue = entryValue(entry);
  if (playedValue === null) throw new Error('Unknown card in your hand — specify its rank first.');

  if (anyCaptureAvailable(g.hand, g.table) && captureIds.length === 0) {
    throw new Error('You must capture when a capture is available.');
  }

  const capture = uniqueEntries(g.table, captureIds);
  const options = legalCaptures(g.table, playedValue);
  if (capture.length > 0 && !options.some((o) => isSameCapture(o, capture))) {
    throw new Error('That selection does not total 15.');
  }

  const sweep = isSweep(g.table, capture);
  const remaining = g.table.filter((e) => !capture.some((c) => c.id === e.id));
  const discarded = capture.length === 0;

  return touch({
    ...g,
    hand: g.hand.filter((e) => e.id !== entryId),
    table: discarded ? [...remaining, entry] : remaining,
    captured: g.captured.map((pile, i) =>
      i === 0 && !discarded ? [...pile, ...capture, entry] : pile
    ),
    sweeps: g.sweeps.map((n, i) => (i === 0 && sweep ? n + 1 : n)),
    turn: 1,
    turns: [...g.turns, { player: 0, played: entry, captured: capture, sweep, deal: g.deal, inferredValue: null }],
    lastCapture: capture.length > 0 ? 0 : g.lastCapture
  });
}

function uniqueEntries(table: Entry[], ids: string[]): Entry[] {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new Error('Duplicate table card selection.');
  return unique.map((id) => {
    const found = table.find((e) => e.id === id);
    if (!found) throw new Error('Selected card is not on the table.');
    return found;
  });
}

export function recordOpponentPlay(g: Game, input: PlayedInput, captureIds: string[]): Game {
  if (g.phase !== 'playing') throw new Error('The game is not in play.');
  if (g.turn === 0) throw new Error('It is your turn.');
  assertDeckSpace(g);
  const player = g.turn;
  const capture = uniqueEntries(g.table, captureIds);

  let played: Entry;
  let inferredValue: number | null = null;

  if (input.kind === 'rank') {
    assertRankAvailable(g, input.rank);
    played = rankEntry(input.rank);
  } else {
    played = unknownEntry();
  }

  if (played.kind === 'rank') {
    const playedValue = entryValue(played);
    if (playedValue !== null && capture.length > 0) {
      const total = capture.reduce((sum, e) => sum + (entryValue(e) ?? NaN), 0);
      if (Number.isNaN(total)) throw new Error('Captured table cards must be known to record this.');
      if (total + playedValue !== 15) throw new Error('The played card and captured cards do not total 15.');
    }
    if (capture.length === 0) {
      if (playedValue !== null && legalCaptures(g.table, playedValue).length > 0) {
        throw new Error('That card can capture; select the captured table cards.');
      }
    }
  } else if (capture.length > 0) {
    const total = capture.reduce((sum, e) => sum + (entryValue(e) ?? NaN), 0);
    if (Number.isNaN(total)) throw new Error('Captured table cards must be known to infer the played card.');
    const inferred = 15 - total;
    const rank = valueToRank(inferred);
    if (rank === null) throw new Error('Captured cards cannot make 15 with a valid card.');
    if (remainingRankCount(g, rank) <= 0) throw new Error('No unseen copy matches the inferred value.');
    played = rankEntry(rank);
    inferredValue = inferred;
  }

  const sweep = isSweep(g.table, capture);
  const table = g.table.filter((e) => !capture.some((c) => c.id === e.id));
  const playedToTable = capture.length === 0;
  const unknownDiscard = played.kind === 'unknown' && capture.length === 0;

  return touch({
    ...g,
    table: playedToTable ? [...table, played] : table,
    captured: g.captured.map((pile, i) =>
      i === player ? [...pile, ...capture, ...(capture.length > 0 ? [played] : [])] : pile
    ),
    sweeps: g.sweeps.map((n, i) => (i === player && sweep ? n + 1 : n)),
    turn: ((player + 1) % 3) as Player,
    turns: [...g.turns, { player, played, captured: capture, sweep, deal: g.deal, inferredValue }],
    lastCapture: capture.length > 0 ? player : g.lastCapture,
    unknownDiscards: g.unknownDiscards + (unknownDiscard ? 1 : 0)
  });
}

export function playsThisDeal(g: Game, player: Player): number {
  return g.turns.filter((t) => t.deal === g.deal && t.player === player).length;
}

export function expectedPlaysThisDeal(g: Game): number {
  if (g.deal === g.startDeal && g.midRound) return Math.max(0, g.opponentStartHand);
  return 3;
}

export function canAdvanceDeal(g: Game): { ok: boolean; reason: string } {
  if (g.phase !== 'playing') return { ok: false, reason: 'The game is not in play.' };
  if (g.hand.length > 0) return { ok: false, reason: 'Play all your hand cards first.' };
  if (g.deal >= 4) return { ok: false, reason: 'That was the last deal.' };
  const expected = expectedPlaysThisDeal(g);
  for (const player of PLAYERS) {
    if (playsThisDeal(g, player) < expected) {
      return { ok: false, reason: `Player ${player + 1} still has cards to record this deal.` };
    }
  }
  return { ok: true, reason: '' };
}

export function nextDeal(g: Game): Game {
  const check = canAdvanceDeal(g);
  if (!check.ok) throw new Error(check.reason);
  return touch({
    ...g,
    deal: g.deal + 1,
    hand: [],
    opponentStartHand: 3,
    midRound: false
  });
}

export function canFinish(g: Game): { ok: boolean; reason: string } {
  if (g.phase !== 'playing') return { ok: false, reason: 'The game is not in play.' };
  if (g.deal !== 4) return { ok: false, reason: 'Finish the fourth deal first.' };
  if (g.hand.length > 0) return { ok: false, reason: 'Play all your hand cards first.' };
  const expected = expectedPlaysThisDeal(g);
  for (const player of PLAYERS) {
    if (playsThisDeal(g, player) < expected) {
      return { ok: false, reason: 'Record every remaining turn first.' };
    }
  }
  return { ok: true, reason: '' };
}

export function finishGame(g: Game): Game {
  const check = canFinish(g);
  if (!check.ok) throw new Error(check.reason);
  const recipient = g.lastCapture;
  return touch({
    ...g,
    phase: 'finished',
    table: recipient === null ? g.table : [],
    captured:
      recipient === null
        ? g.captured
        : g.captured.map((pile, i) => (i === recipient ? [...pile, ...g.table] : pile))
  });
}
