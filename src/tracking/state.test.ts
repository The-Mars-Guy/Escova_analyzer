import { describe, expect, it } from 'vitest';
import { Card, CardKey, Rank, Suit, cardKey } from '../game/cards';
import { exactEntry, rankEntry } from '../game/entries';
import { HOUSE_CONFIG } from '../game/config';
import {
  Game,
  addCard,
  canAdvanceDeal,
  canFinish,
  claimInitialEscova,
  declareHandEscova,
  finishGame,
  handEscovaInfo,
  initialGame,
  nextDeal,
  playCard,
  recordOpponentPlay,
  resolveEntry,
  startGame,
  usedExactKeys
} from './state';

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const e = (suit: Suit, rank: Rank) => exactEntry(card(suit, rank));

function playingGame(overrides: Partial<Game> = {}): Game {
  return initialGame({
    phase: 'playing',
    config: { ...HOUSE_CONFIG },
    opponentStartHand: 3,
    ...overrides
  });
}

describe('setup', () => {
  it('requires four table cards and three hand cards for a new round', () => {
    const g = initialGame({ table: [e('oros', 1), e('copas', 2), e('espadas', 3), e('bastos', 4)], hand: [e('oros', 5), e('copas', 6), e('espadas', 7)] });
    expect(startGame(g).phase).toBe('playing');
    expect(() => startGame(initialGame())).toThrow(/four table cards/i);
  });

  it('rejects duplicate exact cards', () => {
    const g = initialGame({ table: [e('oros', 1)] });
    expect(() => addCard(g, 'hand', card('oros', 1))).toThrow(/already accounted/i);
  });

  it('gives opening table cards totalling 15 to the dealer', () => {
    const g = initialGame({
      table: [e('oros', 10), e('copas', 2), e('espadas', 3), e('bastos', 2)],
      hand: [e('oros', 1), e('copas', 4), e('espadas', 6)]
    });
    const claimed = claimInitialEscova(g, 1);
    expect(claimed.table).toHaveLength(0);
    expect(claimed.sweeps[1]).toBe(1);
    expect(claimed.captured[1]).toHaveLength(4);
    expect(startGame(claimed).phase).toBe('playing');
  });

  it('starts mid-round without demanding history', () => {
    const g = initialGame({
      midRound: true,
      turn: 1,
      deal: 3,
      table: [e('oros', 10)],
      hand: [e('copas', 5)],
      opponentStartHand: 2
    });
    expect(startGame(g).phase).toBe('playing');
  });
});

describe('playing', () => {
  it('captures, clears the table and awards an escova', () => {
    const g = playingGame({ hand: [e('oros', 5)], table: [e('copas', 10), e('bastos', 2)] });
    const ids = g.table.map((x) => x.id);
    const next = playCard(g, g.hand[0].id, ids);
    expect(next.table).toHaveLength(0);
    expect(next.sweeps[0]).toBe(1);
    expect(next.captured[0]).toHaveLength(3);
    expect(next.turn).toBe(1);
    expect(next.turns[0].sweep).toBe(true);
  });

  it('forces a capture when one is available', () => {
    const g = playingGame({ hand: [e('oros', 7), e('copas', 2)], table: [e('espadas', 10)] });
    const seven = g.hand.find((x) => x.id === 'x') ?? g.hand[0];
    expect(() => playCard(g, seven.id, [])).toThrow(/must capture/i);
  });

  it('increments the turn through all three players', () => {
    const g = playingGame({ hand: [e('oros', 1), e('copas', 2), e('espadas', 3)] });
    let next = playCard(g, g.hand[0].id, []);
    expect(next.turn).toBe(1);
    next = recordOpponentPlay(next, { kind: 'exact', card: card('bastos', 4) }, []);
    expect(next.turn).toBe(2);
    next = recordOpponentPlay(next, { kind: 'exact', card: card('bastos', 5) }, []);
    expect(next.turn).toBe(0);
  });
});

describe('unknown cards', () => {
  it('infers the played rank from a known capture without inventing a suit', () => {
    const g = playingGame({
      turn: 1,
      table: [e('oros', 3), e('copas', 7)]
    });
    const ids = g.table.map((x) => x.id);
    const next = recordOpponentPlay(g, { kind: 'unknown' }, ids);
    const turn = next.turns[0];
    expect(turn.played.kind).toBe('rank');
    if (turn.played.kind === 'rank') expect(turn.played.rank).toBe(5);
    expect(turn.inferredValue).toBe(5);
    expect(next.captured[1]).toHaveLength(3);
    expect(next.sweeps[1]).toBe(1);
  });

  it('keeps an unknown discard on the table without blocking play', () => {
    const g = playingGame({ turn: 2, table: [e('oros', 5)] });
    const next = recordOpponentPlay(g, { kind: 'unknown' }, []);
    expect(next.unknownDiscards).toBe(1);
    expect(next.table).toHaveLength(2);
    expect(next.table[1].kind).toBe('unknown');
    expect(next.turn).toBe(0);
  });

  it('allows unknown entries to be resolved later', () => {
    const g = playingGame({ turn: 2, table: [e('oros', 5)] });
    const withUnknown = recordOpponentPlay(g, { kind: 'unknown' }, []);
    const unknown = withUnknown.table.find((x) => x.kind === 'unknown')!;
    const resolved = resolveEntry(withUnknown, unknown.id, card('bastos', 7));
    expect(resolved.table[1].kind).toBe('exact');
    expect(usedExactKeys(resolved).has(cardKey(card('bastos', 7)))).toBe(true);
  });

  it('accepts a rank-only opponent card', () => {
    const g = playingGame({ turn: 1, table: [e('oros', 6)] });
    const next = recordOpponentPlay(g, { kind: 'rank', rank: 11 }, g.table.map((x) => x.id));
    expect(next.turns[0].played.kind).toBe('rank');
    expect(next.sweeps[1]).toBe(1);
  });
});

describe('hand escova', () => {
  const hand = [rankEntry(10), rankEntry(6), rankEntry(1)];

  it('detects a three-card hand totalling 15', () => {
    const g = playingGame({ hand });
    expect(handEscovaInfo(g).possible).toBe(true);
  });

  it('records the bonus only once per hand', () => {
    const g = playingGame({ hand });
    const declared = declareHandEscova(g);
    expect(declared.handBonus[0]).toBe(1);
    expect(() => declareHandEscova(declared)).toThrow(/already/i);
  });

  it('auto-records when configured', () => {
    const g = playingGame({ config: { ...HOUSE_CONFIG, autoHandEscova: true } });
    let next = addCard(g, 'hand', card('oros', 10));
    next = addCard(next, 'hand', card('copas', 5));
    next = addCard(next, 'hand', card('espadas', 2));
    expect(next.handBonus[0]).toBe(1);
    expect(next.handBonusDeclared).toHaveLength(1);
  });
});

describe('deals and finishing', () => {
  function finishedDeal(deal: number, plays = 3): Game {
    const turns = [0, 1, 2].flatMap((player) =>
      Array.from({ length: plays }, () => ({
        player: player as 0 | 1 | 2,
        played: e('oros', 1),
        captured: [],
        sweep: false,
        deal,
        inferredValue: null
      }))
    );
    return playingGame({ deal, hand: [], turns, lastCapture: 1 });
  }

  it('advances only after every hand is empty', () => {
    const g = finishedDeal(1);
    expect(canAdvanceDeal(g).ok).toBe(true);
    expect(nextDeal(g).deal).toBe(2);
    expect(nextDeal(g).hand).toHaveLength(0);
  });

  it('refuses to advance while opponent turns are unrecorded', () => {
    const g = playingGame({ deal: 1, hand: [], turns: [] });
    expect(canAdvanceDeal(g).ok).toBe(false);
  });

  it('awards remaining table cards to the last capturer on finish', () => {
    const g = finishedDeal(4);
    const withTable: Game = { ...g, table: [e('bastos', 6)] };
    expect(canFinish(withTable).ok).toBe(true);
    const done = finishGame(withTable);
    expect(done.phase).toBe('finished');
    expect(done.captured[1].some((x) => x.kind === 'exact' && x.card.rank === 6)).toBe(true);
    expect(done.table).toHaveLength(0);
  });

  it('never stores the same exact card twice', () => {
    const g = playingGame({ hand: [e('oros', 1)] });
    const next = playCard(g, g.hand[0].id, []);
    const keys: CardKey[] = [...usedExactKeys(next)];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
