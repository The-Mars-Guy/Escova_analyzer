import { useState } from 'react';
import { RANKS, rankLabel } from '../game/cards';
import { entryLabel, entryShort, rankEntry } from '../game/entries';
import {
  Game,
  deadRankCounts,
  markRankSeen,
  rankEntryCounts,
  removeEntry,
  resolveEntry,
  unmarkRankSeen
} from '../tracking/state';
import {
  accountedCardCount,
  informationPercent,
  openEntries,
  remainingRankCopies,
  unseenCount
} from '../tracking/selectors';
import { CardTile } from './CardTile';
import { RankPicker } from './RankPicker';

interface Props {
  game: Game;
  dispatch: (update: (current: Game) => Game) => boolean;
}

export function TrackerScreen({ game, dispatch }: Props) {
  const [resolveId, setResolveId] = useState<string | null>(null);
  const entries = rankEntryCounts(game);
  const dead = deadRankCounts(game);
  const remaining = remainingRankCopies(game);
  const open = openEntries(game);
  const resolveTarget = open.find((e) => e.id === resolveId) ?? null;

  return (
    <div className="tracker">
      <div className="status-strip">
        <span>{game.hand.length} in hand</span>
        <span>{game.table.length} on table</span>
        <span>{accountedCardCount(game)} accounted</span>
        <span>{unseenCount(game)} unseen</span>
      </div>

      <section className="panel">
        <div className="panel-title">
          <h2>Rank tracker</h2>
          <span>{informationPercent(game)}% resolved</span>
        </div>
        <p className="hint">
          Four copies of every rank. Mark a copy as seen earlier if it is already out of play; seen copies
          are excluded from probability calculations.
        </p>

        <div className="rank-tracker">
          {RANKS.map((rank) => {
            const inHand = game.hand.filter((e) => e.kind === 'rank' && e.rank === rank).length;
            const onTable = game.table.filter((e) => e.kind === 'rank' && e.rank === rank).length;
            const captured = game.captured.reduce(
              (sum, pile) => sum + pile.filter((e) => e.kind === 'rank' && e.rank === rank).length,
              0
            );
            const seen = dead.get(rank) ?? 0;
            const left = remaining.get(rank) ?? 0;
            const totalKnown = entries.get(rank) ?? 0;
            return (
              <div className="rank-track-row" key={rank}>
                <CardTile entry={rankEntry(rank, `t-${rank}`)} small />
                <div className="rank-track-info">
                  <strong>Rank {rankLabel(rank)}</strong>
                  <span>
                    {inHand} hand · {onTable} table · {captured} taken · {seen} seen
                  </span>
                  <small>{left} unseen cop{left === 1 ? 'y' : 'ies'}</small>
                </div>
                <div className="rank-track-actions">
                  <button
                    type="button"
                    className="ghost small"
                    disabled={left <= 0}
                    onClick={() => dispatch((g) => markRankSeen(g, rank))}
                  >
                    + Seen
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={seen <= 0}
                    onClick={() => dispatch((g) => unmarkRankSeen(g, rank))}
                  >
                    − Seen
                  </button>
                  <span className={`status ${totalKnown === 4 ? 'captured' : left === 0 ? 'dead' : 'unseen'}`}>
                    {totalKnown}/4 in play
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Unresolved cards ({open.length})</h2>
        {open.length ? (
          <div className="unresolved-list">
            {open.map((entry) => (
              <div className="unresolved-row" key={entry.id}>
                <CardTile entry={entry} small />
                <div>
                  <strong>{entryLabel(entry)}</strong>
                  <small>
                    {game.hand.some((e) => e.id === entry.id)
                      ? 'In your hand'
                      : game.table.some((e) => e.id === entry.id)
                        ? 'On the table'
                        : 'In a captured pile'}
                  </small>
                </div>
                <button type="button" className="secondary small" onClick={() => setResolveId(entry.id)}>
                  Specify
                </button>
                {game.table.some((e) => e.id === entry.id) ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => dispatch((g) => removeEntry(g, entry.id))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">Every entered card has a known rank.</p>
        )}
      </section>

      <section className="panel">
        <h2>Turn history</h2>
        {game.turns.length ? (
          <div className="history">
            {[...game.turns].reverse().map((turn, index) => (
              <div className="history-row" key={game.turns.length - index}>
                <span className="history-player">P{turn.player + 1}</span>
                <span>
                  {turn.played.kind === 'unknown'
                    ? `0 unknown${turn.inferredValue ? ` (value ${turn.inferredValue})` : ''}`
                    : entryLabel(turn.played)}
                  {turn.captured.length
                    ? ` → took ${turn.captured.map((e) => entryShort(e)).join(', ')}`
                    : ' → discarded'}
                </span>
                {turn.sweep ? <span className="badge gold">ESCOVA</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No moves recorded yet.</p>
        )}
      </section>

      <section className="panel compact">
        <h2>Captured piles</h2>
        <div className="pile-grid">
          {game.captured.map((pile, i) => (
            <div key={i}>
              <strong>{i === 0 ? 'You' : `Player ${i + 1}`}</strong>
              <span>{pile.length} cards</span>
              <small>
                {pile.filter((e) => e.kind === 'unknown').length} unresolved
              </small>
            </div>
          ))}
        </div>
      </section>

      {resolveTarget ? (
        <RankPicker
          title="Specify the card"
          remaining={remaining}
          onPickRank={(rank) => {
            if (dispatch((g) => resolveEntry(g, resolveTarget.id, rank))) setResolveId(null);
          }}
          onClose={() => setResolveId(null)}
        />
      ) : null}
    </div>
  );
}
