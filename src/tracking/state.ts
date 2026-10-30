import { Card, CardKey, Rank, cardKey, cardValue, isRank, rankValue, valueToRank } from '../game/cards';
import { Entry, entryValue, exactEntry, rankEntry, unknownEntry } from '../game/entries';
import { anyCaptureAvailable, isSameCapture, isSweep, legalCaptures, tableSum } from '../game/rules';
import { HOUSE_CONFIG, ScoringConfig } from '../game/config';
import { ScoringResult, scoreRound } from '../game/scoring';

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
  version: 2;
  id: string;
  phase: 'setup' | 'playing' | 'finished';
  deal: number;
  turn: Player;
  hand: Entry[];
  table: Entry[];
  captured: Entry[][];
  sweeps: number[];
  handBonus: number[];
  handBonusDeclared: string[];
  handBonusAwarded: boolean;
  turns: TurnRecord[];
  lastCapture: Player | null;
  unknownDiscards: number;
  config: ScoringConfig;
  priorScores: number[];
  midRound: boolean;
  opponentStartHand: number;
  startDeal: number;
  claimedInitial: boolean;
  deadCards: CardKey[];
  createdAt: number;
  updatedAt: number;
}

export type PlayedInput =
  | { kind: 'exact'; card: Card }
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
    version: 2,
    id: gameId(),
    phase: 'setup',
    deal: 1,
    turn: 0,
    hand: [],
    table: [],
    captured: [[], [], []],
    sweeps: [0, 0, 0],
    handBonus: [0, 0, 0],
    handBonusDeclared: [],
    handBonusAwarded: false,
    turns: [],
    lastCapture: null,
    unknownDiscards: 0,
    config: { ...HOUSE_CONFIG },
    priorScores: [0, 0, 0],
    midRound: false,
    opponentStartHand: 3,
    startDeal: 1,
    claimedInitial: false,
    deadCards: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function touch(g: Game): Game {
  return { ...g, updatedAt: Date.now() };
}

function allEntries(g: Game): Entry[] {
  return [...g.hand, ...g.table, ...g.captured.flat()];
}

export function usedExactKeys(g: Game): Set<CardKey> {
  const keys = new Set<CardKey>();
  for (const e of allEntries(g)) {
    if (e.kind === 'exact') keys.add(cardKey(e.card));
  }
  return keys;
}

export function usedExactKeysWithDead(g: Game): Set<CardKey> {
  const keys = usedExactKeys(g);
  for (const k of g.deadCards) keys.add(k);
  return keys;
}

function assertCardAvailable(g: Game, card: Card, exceptEntryId?: string): void {
  const key = cardKey(card);
  if (g.deadCards.includes(key)) throw new Error('That card was already seen earlier in the game.');
  for (const e of allEntries(g)) {
    if (e.kind === 'exact' && cardKey(e.card) === key && e.id !== exceptEntryId) {
      throw new Error('That card is already accounted for.');
    }
  }
}

function findEntry(g: Game, id: string): Entry | null {
  return allEntries(g).find((e) => e.id === id) ?? null;
}

/** Adds an exact card to the table (setup only) or to your hand. */
export function addCard(g: Game, zone: 'hand' | 'table', card: Card): Game {
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
  assertCardAvailable(g, card);
  const entry = exactEntry(card);
  const next = zone === 'hand' ? { ...g, hand: [...g.hand, entry] } : { ...g, table: [...g.table, entry] };
  return touch(g.phase === 'playing' && zone === 'hand' ? syncAutoHandEscova(next) : next);
}

export function addUnknownToTable(g: Game): Game {
  if (g.phase !== 'setup') throw new Error('Unknown table cards can only be added during setup.');
  return touch({ ...g, table: [...g.table, unknownEntry()] });
}

export function addRankToTable(g: Game, rank: Rank): Game {
  if (g.phase !== 'setup') throw new Error('Table cards can only be edited during setup.');
  if (!isRank(rank)) throw new Error('Invalid rank.');
  return touch({ ...g, table: [...g.table, rankEntry(rank)] });
}

export function removeEntry(g: Game, id: string): Game {
  if (g.phase === 'finished') throw new Error('The game is finished.');
  const strip = (list: Entry[]) => list.filter((e) => e.id !== id);
  const wasInHand = g.hand.some((e) => e.id === id);
  const rollbackBonus = wasInHand && g.handBonusAwarded && playsThisDeal(g, 0) === 0;
  return touch({
    ...g,
    hand: strip(g.hand),
    table: strip(g.table),
    captured: g.captured.map((pile) => strip(pile)),
    handBonus: rollbackBonus ? g.handBonus.map((n, i) => (i === 0 ? Math.max(0, n - 1) : n)) : g.handBonus,
    handBonusDeclared: rollbackBonus ? [] : g.handBonusDeclared,
    handBonusAwarded: rollbackBonus ? false : g.handBonusAwarded
  });
}

/** Replaces an unknown or rank-only entry once its identity becomes known. */
export function resolveEntry(g: Game, id: string, card: Card): Game {
  const target = findEntry(g, id);
  if (!target) throw new Error('Entry not found.');
  if (target.kind === 'exact' && cardKey(target.card) === cardKey(card)) return g;
  assertCardAvailable(g, card, id);
  const replacement = exactEntry(card, id);
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

export function setPriorScore(g: Game, player: Player, points: number): Game {
  if (!Number.isFinite(points) || points < 0) throw new Error('Score must be a positive number.');
  return touch({ ...g, priorScores: g.priorScores.map((p, i) => (i === player ? Math.round(points) : p)) });
}

export function setConfig(g: Game, patch: Partial<ScoringConfig>): Game {
  const next = { ...g, config: { ...g.config, ...patch } };
  return touch(next.config.autoHandEscova ? syncAutoHandEscova(next) : next);
}

export function setMidRound(g: Game, midRound: boolean): Game {
  return touch({ ...g, midRound });
}

export function setOpponentStartHand(g: Game, n: number): Game {
  const clamped = Math.max(0, Math.min(3, Math.round(n)));
  return touch({ ...g, opponentStartHand: clamped });
}

export function toggleDeadCard(g: Game, key: CardKey): Game {
  if (usedExactKeys(g).has(key)) throw new Error('That card is already in play.');
  const deadCards = g.deadCards.includes(key)
    ? g.deadCards.filter((k) => k !== key)
    : [...g.deadCards, key];
  return touch({ ...g, deadCards });
}

export function handTotal(hand: Entry[]): number | null {
  let total = 0;
  for (const e of hand) {
    if (e.kind === 'unknown') return null;
    total += e.kind === 'exact' ? cardValue(e.card) : rankValue(e.rank);
  }
  return total;
}

export function isThreeCardEscova(hand: Entry[]): boolean {
  return hand.length === 3 && handTotal(hand) === 15;
}

export function handSignature(hand: Entry[]): string {
  return hand
    .map((e) => (e.kind === 'exact' ? cardKey(e.card) : e.kind === 'rank' ? `r${e.rank}` : 'u'))
    .sort()
    .join('|');
}

export interface HandEscovaInfo {
  possible: boolean;
  total: number | null;
  declared: boolean;
  signature: string;
}

export function handEscovaInfo(g: Game): HandEscovaInfo {
  const signature = handSignature(g.hand);
  return {
    possible: isThreeCardEscova(g.hand),
    total: handTotal(g.hand),
    declared: g.handBonusAwarded || g.handBonusDeclared.includes(signature),
    signature
  };
}

export function declareHandEscova(g: Game): Game {
  const info = handEscovaInfo(g);
  if (!info.possible) throw new Error('Your three cards do not total 15.');
  if (info.declared) throw new Error('This hand escova has already been recorded.');
  return touch({
    ...g,
    handBonus: g.handBonus.map((n, i) => (i === 0 ? n + 1 : n)),
    handBonusDeclared: [...g.handBonusDeclared, info.signature],
    handBonusAwarded: true
  });
}

function syncAutoHandEscova(g: Game): Game {
  if (!g.config.autoHandEscova || g.handBonusAwarded) return g;
  const info = handEscovaInfo(g);
  if (!info.possible || info.declared) return g;
  return {
    ...g,
    handBonus: g.handBonus.map((n, i) => (i === 0 ? n + 1 : n)),
    handBonusDeclared: [...g.handBonusDeclared, info.signature],
    handBonusAwarded: true
  };
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
  const next: Game = {
    ...g,
    phase: 'playing',
    deal: g.deal,
    startDeal: g.deal,
    handBonusDeclared: [],
    handBonusAwarded: false,
    updatedAt: Date.now()
  };
  return touch(syncAutoHandEscova(next));
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
  if (capture.length > 0) {
    const matches = options.some((o) => isSameCapture(o, capture));
    if (!matches) throw new Error('That selection does not total 15.');
  }

  const sweep = isSweep(g.table, capture);
  const remaining = g.table.filter((e) => !capture.some((c) => c.id === e.id));
  const discarded = capture.length === 0;
  const next: Game = {
    ...g,
    hand: g.hand.filter((e) => e.id !== entryId),
    table: discarded ? [...remaining, entry] : remaining,
    captured: g.captured.map((pile, i) =>
      i === 0 && !discarded ? [...pile, ...capture, entry] : pile
    ),
    sweeps: g.sweeps.map((n, i) => (i === 0 && sweep ? n + 1 : n)),
    turn: 1,
    turns: [...g.turns, { player: 0, played: entry, captured: capture, sweep, deal: g.deal, inferredValue: null }],
    lastCapture: capture.length > 0 ? 0 : g.lastCapture,
    updatedAt: Date.now()
  };
  return next;
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
  const player = g.turn;
  const capture = uniqueEntries(g.table, captureIds);

  let played: Entry;
  let inferredValue: number | null = null;

  if (input.kind === 'exact') {
    assertCardAvailable(g, input.card);
    played = exactEntry(input.card);
  } else if (input.kind === 'rank') {
    if (!isRank(input.rank)) throw new Error('Invalid rank.');
    const used = usedExactKeys(g);
    const anySuit = (['oros', 'copas', 'espadas', 'bastos'] as const).some(
      (suit) => !used.has(cardKey({ suit, rank: input.rank }))
    );
    if (!anySuit) throw new Error('Every card of that rank is already accounted for.');
    played = rankEntry(input.rank);
  } else {
    played = unknownEntry();
  }

  if (played.kind !== 'unknown') {
    const playedValue = entryValue(played);
    if (playedValue !== null && capture.length > 0) {
      const total = capture.reduce((sum, e) => sum + (entryValue(e) ?? NaN), 0);
      if (Number.isNaN(total)) throw new Error('Captured table cards must be known to record this.');
      if (total + playedValue !== 15) throw new Error('The played card and captured cards do not total 15.');
    }
  } else if (capture.length > 0) {
    const total = capture.reduce((sum, e) => sum + (entryValue(e) ?? NaN), 0);
    if (Number.isNaN(total)) throw new Error('Captured table cards must be known to infer the played card.');
    const inferred = 15 - total;
    const rank = valueToRank(inferred);
    if (rank === null) throw new Error('Captured cards cannot make 15 with a valid card.');
    const used = usedExactKeys(g);
    const anySuit = (['oros', 'copas', 'espadas', 'bastos'] as const).some(
      (suit) => !used.has(cardKey({ suit, rank }))
    );
    if (!anySuit) throw new Error('No unseen card matches the inferred value.');
    played = rankEntry(rank);
    inferredValue = inferred;
  }

  if (played.kind !== 'unknown' && capture.length === 0) {
    const playedValue = entryValue(played);
    if (playedValue !== null && legalCaptures(g.table, playedValue).length > 0) {
      throw new Error('That card can capture; select the captured table cards.');
    }
  }

  const sweep = isSweep(g.table, capture);
  const table = g.table.filter((e) => !capture.some((c) => c.id === e.id));
  const playedToTable = capture.length === 0;
  const unknownDiscard = played.kind === 'unknown' && capture.length === 0;
  const next: Game = {
    ...g,
    table: playedToTable ? [...table, played] : table,
    captured: g.captured.map((pile, i) =>
      i === player ? [...pile, ...capture, ...(capture.length > 0 ? [played] : [])] : pile
    ),
    sweeps: g.sweeps.map((n, i) => (i === player && sweep ? n + 1 : n)),
    turn: ((player + 1) % 3) as Player,
    turns: [...g.turns, { player, played, captured: capture, sweep, deal: g.deal, inferredValue }],
    lastCapture: capture.length > 0 ? player : g.lastCapture,
    unknownDiscards: g.unknownDiscards + (unknownDiscard ? 1 : 0),
    updatedAt: Date.now()
  };
  return next;
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
  for (const p of PLAYERS) {
    if (playsThisDeal(g, p) < expected) {
      return { ok: false, reason: `Player ${p + 1} still has cards to record this deal.` };
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
    midRound: false,
    handBonusAwarded: false
  });
}

export function canFinish(g: Game): { ok: boolean; reason: string } {
  if (g.phase !== 'playing') return { ok: false, reason: 'The game is not in play.' };
  if (g.deal !== 4) return { ok: false, reason: 'Finish the fourth deal first.' };
  if (g.hand.length > 0) return { ok: false, reason: 'Play all your hand cards first.' };
  const expected = expectedPlaysThisDeal(g);
  for (const p of PLAYERS) {
    if (playsThisDeal(g, p) < expected) {
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

export function computeScores(g: Game): ScoringResult {
  return scoreRound({
    captured: g.captured,
    sweeps: g.sweeps,
    handBonus: g.handBonus,
    priorScores: g.priorScores,
    config: g.config
  });
}


