import { Rank } from '../game/cards';
import { Entry, entryShort, entryValue } from '../game/entries';
import { anyCaptureAvailable, legalCaptures } from '../game/rules';
import { Game, handTotal, isThreeCardEscova } from '../tracking/state';
import { informationPercent, openEntries, opponentHandSizes } from '../tracking/selectors';
import { assessThreat, sampleWorlds, Threat } from './monteCarlo';

export interface MoveOption {
  entry: Entry;
  rank: Rank | null;
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
  handTotal: number | null;
  handEscova: boolean;
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

function describe(move: MoveOption, tableSizeAfter: number): string[] {
  const reasons: string[] = [];
  if (move.sweep) {
    reasons.push(`Escova — clears all ${move.capture.length} table cards.`);
  } else if (move.isCapture) {
    reasons.push(
      `Captures ${move.capture.length} card${move.capture.length === 1 ? '' : 's'} worth ${move.capturedValue}.`
    );
    reasons.push(
      `Leaves ${tableSizeAfter} card${tableSizeAfter === 1 ? '' : 's'} on the table.`
    );
  } else {
    reasons.push('No capture is available, so this is a discard.');
  }

  if (move.threat.capture > 0.01) {
    reasons.push(`Opponent capture risk next turn: ~${Math.round(move.threat.capture * 100)}%.`);
  }
  if (move.threat.escoba > 0.01) {
    reasons.push(`Opponent escova risk: ~${Math.round(move.threat.escoba * 100)}%.`);
  }
  return reasons;
}

/** Builds every legal move from your hand. Capturing is mandatory when possible. */
export function buildMoves(g: Game): MoveOption[] {
  const handValues: { entry: Entry; value: number }[] = [];
  for (const entry of g.hand) {
    const value = entryValue(entry);
    if (value !== null) handValues.push({ entry, value });
  }

  const mustCapture = anyCaptureAvailable(g.hand, g.table);
  const moves: MoveOption[] = [];

  for (const { entry, value } of handValues) {
    for (const capture of legalCaptures(g.table, value)) {
      moves.push({
        entry,
        rank: entry.kind === 'rank' ? entry.rank : null,
        playedValue: value,
        capture,
        captureIds: capture.map((e) => e.id),
        sweep: capture.length === g.table.length,
        isCapture: true,
        capturedValue: capture.reduce((sum, e) => sum + (entryValue(e) ?? 0), 0),
        score: 0,
        reasons: [],
        threat: { capture: 0, escoba: 0, samples: 0 }
      });
    }
    if (!mustCapture) {
      moves.push({
        entry,
        rank: entry.kind === 'rank' ? entry.rank : null,
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

function scoreMove(move: MoveOption, threat: Threat): number {
  let score = 0;

  if (move.isCapture) {
    score += move.capture.length * 1.4;
    score += move.capturedValue * 0.15;
    if (move.sweep) score += 12;
  } else {
    score -= 1.2;
  }

  score -= threat.capture * 12;
  score -= threat.escoba * 18;
  return Math.round(score * 100) / 100;
}

export function recommend(g: Game, options: RecommendOptions = {}): Recommendation {
  const iterations = options.iterations ?? 320;
  const seed = options.seed ?? (g.updatedAt % 2147483647 || 1);
  const worlds = sampleWorlds(g, iterations, seed);
  const moves = buildMoves(g);

  for (const move of moves) {
    const after = tableAfter(g, move);
    move.threat = assessThreat(after, worlds);
    move.score = scoreMove(move, move.threat);
    move.reasons = describe(move, after.length);
  }

  moves.sort((a, b) => b.score - a.score);

  const hidden = opponentHandSizes(g).reduce((a, b) => a + b, 0);
  const open = openEntries(g).length;
  const confidence = Math.max(0.15, 1 - (open + hidden) / 40);

  const note =
    worlds.length < iterations
      ? 'Some card combinations are inconsistent with the entered information; check the Cards tab.'
      : `Estimated from ${worlds.length} simulated hidden-card layouts (${Math.round(confidence * 100)}% confidence).`;

  return {
    moves,
    best: moves[0] ?? null,
    handTotal: handTotal(g.hand),
    handEscova: isThreeCardEscova(g.hand),
    information: informationPercent(g),
    hiddenOpponentCards: hidden,
    openCards: open,
    samples: worlds.length,
    note
  };
}

export function moveSummary(move: MoveOption): string {
  if (!move.isCapture) return `Discard ${entryShort(move.entry)}`;
  const cards = move.capture.map((e) => entryShort(e)).join(' + ');
  return `${entryShort(move.entry)} → ${cards}${move.sweep ? ' · ESCOVA' : ''}`;
}
