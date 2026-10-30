import { describe, expect, it } from 'vitest';
import { Rank } from '../game/cards';
import { rankEntry } from '../game/entries';
import { Game, initialGame } from '../tracking/state';
import { buildMoves, recommend } from './engine';

const r = (rank: Rank) => rankEntry(rank);

function playingGame(overrides: Partial<Game> = {}): Game {
  return initialGame({ phase: 'playing', ...overrides });
}

describe('strategy engine', () => {
  it('prefers a legal capture over a discard', () => {
    const g = playingGame({ hand: [r(7), r(2)], table: [r(10)] });
    const rec = recommend(g, { iterations: 80, seed: 7 });
    expect(rec.best?.isCapture).toBe(true);
    expect(rec.best?.sweep).toBe(true);
    expect(rec.moves.filter((m) => m.isCapture)).toHaveLength(1);
  });

  it('only offers captures when a capture exists somewhere in the hand', () => {
    const g = playingGame({ hand: [r(7), r(2)], table: [r(10)] });
    const moves = buildMoves(g);
    expect(moves.every((m) => m.isCapture)).toBe(true);
  });

  it('offers every discard when no capture is possible', () => {
    const g = playingGame({ hand: [r(1), r(2), r(3)], table: [r(10), r(11)] });
    const moves = buildMoves(g);
    expect(moves).toHaveLength(3);
    expect(moves.every((m) => !m.isCapture)).toBe(true);
  });

  it('flags a three-card hand totalling 15', () => {
    const g = playingGame({ hand: [r(10), r(6), r(1)], table: [r(5)] });
    const rec = recommend(g, { iterations: 40, seed: 3 });
    expect(rec.handTotal).toBe(15);
    expect(rec.handEscova).toBe(true);
  });

  it('returns bounded probabilities and a confidence note', () => {
    const g = playingGame({ hand: [r(2)], table: [r(5)] });
    const rec = recommend(g, { iterations: 60, seed: 11 });
    expect(rec.best).not.toBeNull();
    expect(rec.samples).toBeGreaterThan(0);
    expect(rec.best!.threat.capture).toBeGreaterThanOrEqual(0);
    expect(rec.best!.threat.capture).toBeLessThanOrEqual(1);
    expect(rec.best!.threat.escoba).toBeGreaterThanOrEqual(0);
    expect(rec.note).toMatch(/simulated/i);
  });

  it('is deterministic for a fixed seed', () => {
    const g = playingGame({ hand: [r(2)], table: [r(5)] });
    const a = recommend(g, { iterations: 50, seed: 99 });
    const b = recommend(g, { iterations: 50, seed: 99 });
    expect(a.best?.score).toBe(b.best?.score);
    expect(a.best?.threat.capture).toBe(b.best?.threat.capture);
  });
});
