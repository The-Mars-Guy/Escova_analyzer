import { describe, expect, it } from 'vitest';
import { Rank } from '../game/cards';
import { rankEntry } from '../game/entries';
import {
  Game,
  addRankCard,
  canAdvanceDeal,
  canFinish,
  claimInitialEscova,
  finishGame,
  handTotal,
  initialGame,
  isThreeCardEscova,
  markRankSeen,
  nextDeal,
  playCard,
  recordOpponentPlay,
  removeEntry,
  resolveEntry,
  startGame,
  unmarkRankSeen
} from './state';

const r = (rank: Rank) => rankEntry(rank);

function playingGame(overrides: Partial<Game> = {}): Game {
  return initialGame({ phase: 'playing', ...overrides });
}

describe('setup', () => {
  it('requires four table cards and three hand cards for a new round', () => {
    const g = initialGame({
      table: [r(1), r(2), r(3), r(4)],
      hand: [r(5), r(6), r(7)]
    });
    expect(startGame(g).phase).toBe('playing');
    expect(() => startGame(initialGame())).toThrow(/four table cards/i);
  });

  it('rejects a fifth copy of a rank', () => {
    const g = initialGame({ table: [r(5), r(5), r(5), r(5)] });
    expect(() => addRankCard(g, 'table', 5)).toThrow(/four copies/i);
  });

  it('gives opening table cards totalling 15 to the dealer', () => {
    const g = initialGame({
      table: [r(10), r(2), r(3), r(2)],
      hand: [r(1), r(4), r(6)]
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
      table: [r(10)],
      hand: [r(5)],
      opponentStartHand: 2
    });
    expect(startGame(g).phase).toBe('playing');
  });
});

describe('playing', () => {
  it('captures, clears the table and awards an escova', () => {
    const g = playingGame({ hand: [r(5)], table: [r(10), r(2)] });
    const next = playCard(g, g.hand[0].id, g.table.map((x) => x.id));
    expect(next.table).toHaveLength(0);
    expect(next.sweeps[0]).toBe(1);
    expect(next.captured[0]).toHaveLength(3);
    expect(next.turn).toBe(1);
    expect(next.turns[0].sweep).toBe(true);
  });

  it('forces a capture when one is available', () => {
    const g = playingGame({ hand: [r(7), r(2)], table: [r(10)] });
    expect(() => playCard(g, g.hand[0].id, [])).toThrow(/must capture/i);
  });

  it('puts a discard on the table, not in the capture pile', () => {
    const g = playingGame({ hand: [r(1)], table: [r(12)] });
    const next = playCard(g, g.hand[0].id, []);
    expect(next.table).toHaveLength(2);
    expect(next.captured[0]).toHaveLength(0);
    expect(next.turns[0].captured).toHaveLength(0);
    expect(next.lastCapture).toBeNull();
  });

  it('puts a known opponent discard on the table', () => {
    const g = playingGame({ turn: 1, table: [r(5)] });
    const next = recordOpponentPlay(g, { kind: 'rank', rank: 6 }, []);
    expect(next.table).toHaveLength(2);
    expect(next.captured[1]).toHaveLength(0);
    expect(next.unknownDiscards).toBe(0);
    expect(next.turn).toBe(2);
  });

  it('increments the turn through all three players', () => {
    const g = playingGame({ hand: [r(1), r(2), r(3)] });
    let next = playCard(g, g.hand[0].id, []);
    expect(next.turn).toBe(1);
    next = recordOpponentPlay(next, { kind: 'rank', rank: 4 }, []);
    expect(next.turn).toBe(2);
    next = recordOpponentPlay(next, { kind: 'rank', rank: 5 }, []);
    expect(next.turn).toBe(0);
  });
});

describe('rank tracking', () => {
  it('tracks seen copies and never goes above four', () => {
    let g = playingGame();
    g = markRankSeen(g, 7);
    g = markRankSeen(g, 7);
    g = markRankSeen(g, 7);
    g = markRankSeen(g, 7);
    expect(() => markRankSeen(g, 7)).toThrow(/accounted/i);
    const undone = unmarkRankSeen(g, 7);
    expect(undone.deadRanks.filter((x) => x === 7)).toHaveLength(3);
  });

  it('counts in-play copies towards the four-copy limit', () => {
    const g = initialGame({ table: [r(7), r(7), r(7)], hand: [r(7)] });
    expect(() => markRankSeen(g, 7)).toThrow(/accounted/i);
    expect(() => addRankCard(g, 'table', 7)).toThrow(/four copies/i);
  });
});

describe('unknown cards', () => {
  it('infers the played rank from a known capture', () => {
    const g = playingGame({ turn: 1, table: [r(3), r(7)] });
    const next = recordOpponentPlay(g, { kind: 'unknown' }, g.table.map((x) => x.id));
    const turn = next.turns[0];
    expect(turn.played.kind).toBe('rank');
    if (turn.played.kind === 'rank') expect(turn.played.rank).toBe(5);
    expect(turn.inferredValue).toBe(5);
    expect(next.captured[1]).toHaveLength(3);
    expect(next.sweeps[1]).toBe(1);
  });

  it('keeps an unknown discard on the table without blocking play', () => {
    const g = playingGame({ turn: 2, table: [r(5)] });
    const next = recordOpponentPlay(g, { kind: 'unknown' }, []);
    expect(next.unknownDiscards).toBe(1);
    expect(next.table).toHaveLength(2);
    expect(next.table[1].kind).toBe('unknown');
    expect(next.turn).toBe(0);
  });

  it('allows unknown entries to be resolved later', () => {
    const g = playingGame({ turn: 2, table: [r(5)] });
    const withUnknown = recordOpponentPlay(g, { kind: 'unknown' }, []);
    const unknown = withUnknown.table.find((x) => x.kind === 'unknown')!;
    const resolved = resolveEntry(withUnknown, unknown.id, 7);
    expect(resolved.table[1].kind).toBe('rank');
    if (resolved.table[1].kind === 'rank') expect(resolved.table[1].rank).toBe(7);
  });

  it('accepts a rank-only opponent capture', () => {
    const g = playingGame({ turn: 1, table: [r(6)] });
    const next = recordOpponentPlay(g, { kind: 'rank', rank: 11 }, g.table.map((x) => x.id));
    expect(next.turns[0].played.kind).toBe('rank');
    expect(next.sweeps[1]).toBe(1);
  });

  it('rejects an opponent discard when the played card can capture', () => {
    const g = playingGame({ turn: 1, table: [r(10)] });
    expect(() => recordOpponentPlay(g, { kind: 'rank', rank: 7 }, [])).toThrow(/can capture/i);
  });
});

describe('hand totals', () => {
  it('detects a three-card hand totalling 15', () => {
    const g = playingGame({ hand: [r(10), r(6), r(1)] });
    expect(handTotal(g.hand)).toBe(15);
    expect(isThreeCardEscova(g.hand)).toBe(true);
  });
});

describe('deals and finishing', () => {
  function finishedDeal(deal: number, plays = 3): Game {
    const turns = [0, 1, 2].flatMap((player) =>
      Array.from({ length: plays }, () => ({
        player: player as 0 | 1 | 2,
        played: r(1),
        captured: [] as Game['turns'][number]['captured'],
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
  });

  it('refuses to advance while opponent turns are unrecorded', () => {
    const g = playingGame({ deal: 1, hand: [], turns: [] });
    expect(canAdvanceDeal(g).ok).toBe(false);
  });

  it('awards remaining table cards to the last capturer on finish', () => {
    const g = finishedDeal(4);
    const withTable: Game = { ...g, table: [r(6)] };
    expect(canFinish(withTable).ok).toBe(true);
    const done = finishGame(withTable);
    expect(done.phase).toBe('finished');
    expect(done.captured[1]).toHaveLength(1);
    expect(done.table).toHaveLength(0);
  });

  it('can remove a mistakenly entered card', () => {
    const g = initialGame({ table: [r(5)] });
    const next = removeEntry(g, g.table[0].id);
    expect(next.table).toHaveLength(0);
  });
});
