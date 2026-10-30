import { Card, cardValue } from '../game/cards';
import { Entry } from '../game/entries';
import { legalCaptures } from '../game/rules';
import { Game } from '../tracking/state';
import { openEntries, opponentHandSizes, unseenCards } from '../tracking/selectors';
import { mulberry32, shuffle } from './random';

export interface World {
  hands: [Card[], Card[]];
}

export interface Threat {
  capture: number;
  escoba: number;
  samples: number;
}

/**
 * Samples plausible hidden-card worlds consistent with everything the user has
 * entered. Unknown and rank-only entries are resolved first, then the remaining
 * unseen cards are distributed into the two opponents' hands.
 */
export function sampleWorlds(g: Game, iterations: number, seed = 0x5eed): World[] {
  const rng = mulberry32(seed);
  const basePool = unseenCards(g);
  const open = openEntries(g);
  const sizes = opponentHandSizes(g);
  const worlds: World[] = [];

  for (let i = 0; i < iterations; i += 1) {
    let pool = [...basePool];
    let ok = true;

    for (const e of open) {
      if (e.kind !== 'rank') continue;
      const candidates = pool.filter((c) => c.rank === e.rank);
      if (candidates.length === 0) {
        ok = false;
        break;
      }
      const chosen = candidates[Math.floor(rng() * candidates.length)];
      pool = pool.filter((c) => c !== chosen);
    }
    if (!ok) continue;

    for (const e of open) {
      if (e.kind !== 'unknown') continue;
      if (pool.length === 0) {
        ok = false;
        break;
      }
      const idx = Math.floor(rng() * pool.length);
      pool = pool.filter((_, j) => j !== idx);
    }
    if (!ok) continue;

    pool = shuffle(pool, rng);
    const take1 = Math.min(sizes[0], pool.length);
    const take2 = Math.min(sizes[1], pool.length - take1);
    worlds.push({
      hands: [pool.slice(0, take1), pool.slice(take1, take1 + take2)]
    });
  }

  return worlds;
}

/** Probability that either opponent can capture from `table`, and that they can sweep it. */
export function assessThreat(table: Entry[], worlds: World[]): Threat {
  if (table.length === 0) return { capture: 0, escoba: 0, samples: worlds.length };
  let captureCount = 0;
  let escobaCount = 0;

  for (const world of worlds) {
    let canCapture = false;
    let canSweep = false;
    for (const hand of world.hands) {
      for (const card of hand) {
        const captures = legalCaptures(table, cardValue(card));
        if (captures.length > 0) canCapture = true;
        if (captures.some((c) => c.length === table.length)) canSweep = true;
        if (canCapture && canSweep) break;
      }
      if (canCapture && canSweep) break;
    }
    if (canCapture) captureCount += 1;
    if (canSweep) escobaCount += 1;
  }

  const total = worlds.length || 1;
  return { capture: captureCount / total, escoba: escobaCount / total, samples: worlds.length };
}
