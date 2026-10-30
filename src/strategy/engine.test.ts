import { describe, expect, it } from 'vitest';
import { Rank, Suit } from '../game/cards';
import { exactEntry } from '../game/entries';
import { HOUSE_CONFIG } from '../game/config';
import { Game, initialGame } from '../tracking/state';
import { buildMoves, recommend } from './engine';

const e = (suit: Suit, rank: Rank) => exactEntry({ suit, rank });

function playingGame(overrides: Partial<Game> = {}): Game {
  return initialGame({ phase: 'playing', config: { ...HOUSE_CONFIG }, ...overrides });
}

describe('strategy engine', () => {
  it('prefers a legal capture over a discard', () => {
    const g = playingGame({ hand: [e('espadas', 7), e('copas', 2)], table: [e('oros', 10)] });
    const rec = recommend(g, { iterations: 80, seed: 7 });
    expect(rec.best?.isCapture).toBe(true);
    expect(rec.best?.sweep).toBe(true);
    expect(rec.moves.filter((m) => m.isCapture)).toHaveLength(1);
  });

  it('only offers captures when a capture exists somewhere in the hand', () => {
    const g = playingGame({ hand: [e('espadas', 7), e('copas', 2)], table: [e('oros', 10)] });
    const moves = buildMoves(g);
    expect(moves.every((m) => m.isCapture)).toBe(true);
  });

  it('offers every discard when no capture is possible', () => {
    const g = playingGame({
      hand: [e('oros', 1), e('copas', 2), e('espadas', 3)],
      table: [e('oros', 12), e('copas', 12), e('espadas', 12)]
    });
    const moves = buildMoves(g);
    expect(moves).toHaveLength(3);
    expect(moves.every((m) => !m.isCapture)).toBe(true);
  });

  it('surfaces the three-card hand escova as a separate opportunity', () => {
    const g = playingGame({
      hand: [e('oros', 10), e('copas', 5), e('espadas', 2)],
      table: [e('bastos', 6)]
    });
    const rec = recommend(g, { iterations: 40, seed: 3 });
    expect(rec.handEscova.possible).toBe(true);
    expect(rec.handEscova.total).toBe(15);
    expect(rec.bonusAvailable).toBe(true);
  });

  it('returns bounded probabilities and a confidence note', () => {
    const g = playingGame({ hand: [e('copas', 2)], table: [e('oros', 5)] });
    const rec = recommend(g, { iterations: 60, seed: 11 });
    expect(rec.best).not.toBeNull();
    expect(rec.samples).toBeGreaterThan(0);
    expect(rec.best!.threat.capture).toBeGreaterThanOrEqual(0);
    expect(rec.best!.threat.capture).toBeLessThanOrEqual(1);
    expect(rec.best!.threat.escoba).toBeGreaterThanOrEqual(0);
    expect(rec.note).toMatch(/simulated/i);
  });

  it('is deterministic for a fixed seed', () => {
    const g = playingGame({ hand: [e('copas', 2)], table: [e('oros', 5)] });
    const a = recommend(g, { iterations: 50, seed: 99 });
    const b = recommend(g, { iterations: 50, seed: 99 });
    expect(a.best?.score).toBe(b.best?.score);
    expect(a.best?.threat.capture).toBe(b.best?.threat.capture);
  });
});
