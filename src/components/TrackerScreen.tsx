import { useState } from 'react';
import {
  ALL_CARDS,
  CardKey,
  SUITS,
  SUIT_LABEL,
  SUIT_SYMBOL,
  cardKey,
  cardFromKey
} from '../game/cards';
import { Entry, entryLabel, entryShort, exactEntry } from '../game/entries';
import { Game, toggleDeadCard, resolveEntry, removeEntry } from '../tracking/state';
import { accountedCardCount, informationPercent, openEntries, unseenCount } from '../tracking/selectors';
import { CardTile } from './CardTile';
import { DeckPicker } from './DeckPicker';

interface Props {
  game: Game;
  used: Set<CardKey>;
  dispatch: (update: (current: Game) => Game) => boolean;
}

function statusFor(game: Game, key: CardKey): { label: string; className: string } {
  const keyOf = (e: Entry) => (e.kind === 'exact' ? cardKey(e.card) : null);
  if (game.hand.some((e) => keyOf(e) === key)) return { label: 'hand', className: 'in-hand' };
  if (game.table.some((e) => keyOf(e) === key)) return { label: 'table', className: 'on-table' };
  for (let p = 0; p < game.captured.length; p += 1) {
    if (game.captured[p].some((e) => keyOf(e) === key)) {
      return { label: p === 0 ? 'yours' : `P${p + 1}`, className: 'captured' };
    }
  }
  if (game.deadCards.includes(key)) return { label: 'seen', className: 'dead' };
  return { label: '?', className: 'unseen' };
}

export function TrackerScreen({ game, used, dispatch }: Props) {
  const [resolveId, setResolveId] = useState<string | null>(null);
  const open = openEntries(game);
  const openById = new Map<string, Entry>();
  for (const entry of open) openById.set(entry.id, entry);
  const uniqueOpen = [...openById.values()];

  const resolveTarget = uniqueOpen.find((e) => e.id === resolveId) ?? null;

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
          <h2>Card tracker</h2>
          <span>{informationPercent(game)}% resolved</span>
        </div>
        <p className="hint">
          Dimmed cards are accounted for. Tap a card you saw earlier in the game to mark it dead; tap again
          to undo. Dead cards are excluded from probability calculations and cannot be entered again.
        </p>
        {SUITS.map((suit) => (
          <div className="suit-block" key={suit}>
            <h3 className={`suit-heading suit-${suit}`}>
              {SUIT_SYMBOL[suit]} {SUIT_LABEL[suit]}
            </h3>
            <div className="tracker-grid">
              {ALL_CARDS.filter((c) => c.suit === suit).map((card) => {
                const key = cardKey(card);
                const status = statusFor(game, key);
                const clickable = status.className === 'unseen' || status.className === 'dead';
                return (
                  <div className="tracker-cell" key={key}>
                    <CardTile
                      entry={exactEntry(cardFromKey(key), `t-${key}`)}
                      small
                      disabled={!clickable}
                      muted={!clickable}
                      onClick={clickable ? () => dispatch((g) => toggleDeadCard(g, key)) : undefined}
                    />
                    <span className={`status ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Unresolved cards ({uniqueOpen.length})</h2>
        {uniqueOpen.length ? (
          <div className="unresolved-list">
            {uniqueOpen.map((entry) => (
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
          <p className="hint">Every visible card has an exact identity.</p>
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
                {pile.filter((e) => e.kind === 'exact' && e.card.suit === 'oros').length} oros
              </small>
            </div>
          ))}
        </div>
      </section>

      {resolveTarget ? (
        <DeckPicker
          title="Specify the card"
          used={used}
          onPickCard={(card) => {
            if (dispatch((g) => resolveEntry(g, resolveTarget.id, card))) setResolveId(null);
          }}
          onClose={() => setResolveId(null)}
        />
      ) : null}
    </div>
  );
}
