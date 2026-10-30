import { Card, cardShort } from '../game/cards';
import { Entry, entryValue } from '../game/entries';
import { anyCaptureAvailable, legalCaptures } from '../game/rules';
import { Game, HandEscovaInfo, handEscovaInfo } from '../tracking/state';
import { informationPercent, openEntries, opponentHandSizes } from '../tracking/selectors';
import { assessThreat, sampleWorlds, Threat } from './monteCarlo';

export interface MoveOption {
  entry: Entry;
  card: Card | null;
  playedValue: number;
  capture: Entry[];
  captureIds: string[];
  sweep: boolean;
  isCapture: boolean;
  capturedValue: number;
  score: number;
  reasons: string[];
  threat: Threat;
}

export interface Recommendation {
  moves: MoveOption[];
  best: MoveOption | null;
  handEscova: HandEscovaInfo;
  bonusAvailable: boolean;
  information: number;
  hiddenOpponentCards: number;
  openCards: number;
  samples: number;
  note: string;
}

export interface RecommendOptions {
  iterations?: number;
  seed?: number;
}

function keepValue(entry: Entry): number {
  const v = entryValue(entry) ?? 0;
  let keep = v * 0.05;
  if (entry.kind === 'exact') {
    if (entry.card.suit === 'oros') keep += 1.2;
    if (entry.card.rank === 7) keep += 0.9;
    if (entry.card.suit === 'oros' && entry.card.rank === 7) keep += 5;
  }
  return keep;
}

function describe(move: MoveOption): string[] {
  const reasons: string[] = [];
  if (move.sweep) {
    reasons.push(`Escova — clears the table (${move.capture.length} cards taken).`);
  } else if (move.isCapture) {
    reasons.push(`Captures ${move.capture.length} card${move.capture.length === 1 ? '' : 's'} worth ${move.capturedValue}.`);
  } else {
    reasons.push('No capture available, so this is a discard.');
  }

  const oros = move.capture.filter((e) => e.kind === 'exact' && e.card.suit === 'oros').length;
  const sevens = move.capture.filter((e) => e.kind === 'exact' && e.card.rank === 7).length;
  const sevenOfOros = move.capture.some(
    (e) => e.kind === 'exact' && e.card.suit === 'oros' && e.card.rank === 7
  );
  if (sevenOfOros) reasons.push('Takes the 7 de oros (+1 point and denies it to opponents).');
  if (oros > 0) reasons.push(`Includes ${oros} oro${oros === 1 ? '' : 's'} for the oros majority.`);
  if (sevens > 0) reasons.push(`Includes ${sevens} seven${sevens === 1 ? '' : 's'} for the sevens majority.`);
  if (move.isCapture && !sevenOfOros && move.card?.rank === 7) {
    reasons.push('Plays a seven but takes no seven.');
  }

  if (!move.isCapture) {
    if (move.card?.suit === 'oros' && move.card.rank === 7) {
      reasons.push('Warning: you would give away the 7 de oros.');
    } else if (move.card?.rank === 7 || move.card?.suit === 'oros') {
      reasons.push('Discards a card that matters for scoring majorities.');
    }
  }

  if (move.threat.capture > 0.01) {
    const pct = Math.round(move.threat.capture * 100);
    reasons.push(`Opponent capture risk next turn: ~${pct}%.`);
  }
  if (move.threat.escoba > 0.01) {
    const pct = Math.round(move.threat.escoba * 100);
    reasons.push(`Opponent escova risk: ~${pct}%.`);
  }
  return reasons;
}

/** Builds every legal move from your hand. Capturing is mandatory when possible. */
export function buildMoves(g: Game): MoveOption[] {
  const handValues = g.hand
    .map((entry) => ({ entry, value: entryValue(entry) }))
    .filter((x): x is { entry: Entry; value: number } => x.value !== null);

  const mustCapture = anyCaptureAvailable(g.hand, g.table);

  const moves: MoveOption[] = [];
  for (const { entry, value } of handValues) {
    const captures = legalCaptures(g.table, value);
    for (const capture of captures) {
      const capturedValue = capture.reduce((sum, e) => sum + (entryValue(e) ?? 0), 0);
      const sweep = capture.length === g.table.length;
      moves.push({
        entry,
        card: entry.kind === 'exact' ? entry.card : null,
        playedValue: value,
        capture,
        captureIds: capture.map((e) => e.id),
        sweep,
        isCapture: true,
        capturedValue,
        score: 0,
        reasons: [],
        threat: { capture: 0, escoba: 0, samples: 0 }
      });
    }
    if (!mustCapture) {
      moves.push({
        entry,
        card: entry.kind === 'exact' ? entry.card : null,
        playedValue: value,
        capture: [],
        captureIds: [],
        sweep: false,
        isCapture: false,
        capturedValue: 0,
        score: 0,
        reasons: [],
        threat: { capture: 0, escoba: 0, samples: 0 }
      });
    }
  }
  return moves;
}

function tableAfter(g: Game, move: MoveOption): Entry[] {
  const remaining = g.table.filter((e) => !move.captureIds.includes(e.id));
  return move.isCapture ? remaining : [...remaining, move.entry];
}

function scoreMove(g: Game, move: MoveOption, threat: Threat): number {
  let score = 0;
  const capturedCards = move.capture.length + (move.isCapture ? 1 : 0);

  if (move.isCapture) {
    score += capturedCards * 0.9;
    score += move.capturedValue * 0.18;
    const oros = move.capture.filter((e) => e.kind === 'exact' && e.card.suit === 'oros').length;
    const sevens = move.capture.filter((e) => e.kind === 'exact' && e.card.rank === 7).length;
    const sevenOfOros = move.capture.some(
      (e) => e.kind === 'exact' && e.card.suit === 'oros' && e.card.rank === 7
    );
    score += oros * 1.7;
    score += sevens * 1.1;
    if (sevenOfOros) score += 5;
    if (move.sweep) score += 12 * Math.max(1, g.config.escoba);
  } else {
    score -= keepValue(move.entry) + 1.5;
    if (move.card?.suit === 'oros' && move.card.rank === 7) score -= 4;
  }

  score -= threat.capture * 14;
  score -= threat.escoba * 20;
  return Math.round(score * 100) / 100;
}

export function recommend(g: Game, options: RecommendOptions = {}): Recommendation {
  const iterations = options.iterations ?? 320;
  const seed = options.seed ?? (g.updatedAt % 2147483647 || 1);
  const worlds = sampleWorlds(g, iterations, seed);
  const moves = buildMoves(g);

  for (const move of moves) {
    move.threat = assessThreat(tableAfter(g, move), worlds);
    move.score = scoreMove(g, move, move.threat);
    move.reasons = describe(move);
  }

  moves.sort((a, b) => b.score - a.score);

  const hidden = opponentHandSizes(g).reduce((a, b) => a + b, 0);
  const open = openEntries(g).length;
  const information = informationPercent(g);
  const handEscova = handEscovaInfo(g);
  const confidence = Math.max(0.15, 1 - (open + hidden) / 40);

  const note =
    worlds.length < iterations
      ? 'Some card combinations are inconsistent with the entered information; check the tracker.'
      : `Estimated from ${worlds.length} simulated hidden-card layouts (${Math.round(confidence * 100)}% confidence).`;

  return {
    moves,
    best: moves[0] ?? null,
    handEscova,
    bonusAvailable: handEscova.possible && !handEscova.declared,
    information,
    hiddenOpponentCards: hidden,
    openCards: open,
    samples: worlds.length,
    note
  };
}

export function moveSummary(move: MoveOption): string {
  if (!move.isCapture) return `Discard ${move.card ? cardShort(move.card) : 'card'}`;
  const cards = move.capture
    .map((e) => (e.kind === 'exact' ? cardShort(e.card) : e.kind === 'rank' ? `${e.rank}?` : '?'))
    .join(' + ');
  return `${move.card ? cardShort(move.card) : 'Card'} → ${cards}${move.sweep ? ' · ESCOVA' : ''}`;
}
