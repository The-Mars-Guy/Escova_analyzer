import { useEffect, useState } from 'react';
import { rankValue, valueToRank } from '../game/cards';
import { Entry, entryShort, entryValue, rankEntry, unknownEntry } from '../game/entries';
import { captureTotal, legalCaptures } from '../game/rules';
import {
  Game,
  PlayedInput,
  addRankCard,
  canAdvanceDeal,
  canFinish,
  expectedPlaysThisDeal,
  finishGame,
  handTotal,
  nextDeal,
  playCard,
  playsThisDeal,
  recordOpponentPlay,
  removeEntry,
  resolveEntry
} from '../tracking/state';
import { informationPercent, remainingRankCopies, unseenCount } from '../tracking/selectors';
import { MoveOption, Recommendation, moveSummary } from '../strategy/engine';
import { CardTile } from './CardTile';
import { RankPicker } from './RankPicker';

interface Props {
  game: Game;
  rec: Recommendation | null;
  dispatch: (update: (current: Game) => Game) => boolean;
}

function captureText(move: MoveOption): string {
  if (!move.capture.length) return 'no capture';
  return move.capture.map((e) => entryShort(e)).join(' + ');
}

function threatClass(probability: number): string {
  if (probability >= 0.55) return 'high';
  if (probability >= 0.25) return 'medium';
  return 'low';
}

export function PlayScreen({ game, rec, dispatch }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureIds, setCaptureIds] = useState<string[]>([]);
  const [opponentPicker, setOpponentPicker] = useState(false);
  const [pending, setPending] = useState<PlayedInput | null>(null);
  const [opponentCaptureIds, setOpponentCaptureIds] = useState<string[]>([]);
  const [handPicker, setHandPicker] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [otherMoves, setOtherMoves] = useState(false);

  useEffect(() => {
    setSelectedId(null);
    setCaptureIds([]);
    setPending(null);
    setOpponentCaptureIds([]);
    setOtherMoves(false);
  }, [game.updatedAt]);

  const myTurn = game.turn === 0;
  const enteringHand = game.phase === 'playing' && game.hand.length === 0 && playsThisDeal(game, 0) === 0;
  const advancing = canAdvanceDeal(game);
  const finishing = canFinish(game);
  const info = informationPercent(game);
  const unseen = unseenCount(game);
  const unknownOnTable = game.table.filter((e) => e.kind === 'unknown').length;
  const total = handTotal(game.hand);
  const handEscova = game.hand.length === 3 && total === 15;
  const remaining = remainingRankCopies(game);

  const selectedEntry = game.hand.find((e) => e.id === selectedId) ?? null;
  const myMoves = rec && selectedEntry ? rec.moves.filter((m) => m.entry.id === selectedEntry.id) : [];
  const captureOptions = myMoves.filter((m) => m.isCapture);
  const canDiscard = myMoves.some((m) => !m.isCapture);
  const canPlaySelected = captureOptions.length > 0 || canDiscard;
  const playedValue = selectedEntry ? entryValue(selectedEntry) : null;

  const selectedCaptureEntries = captureIds
    .map((id) => game.table.find((e) => e.id === id))
    .filter((e): e is Entry => Boolean(e));
  const selectedCaptureTotal = playedValue !== null ? playedValue + captureTotal(selectedCaptureEntries) : null;
  const captureSelectionMatches =
    captureIds.length > 0 &&
    captureOptions.some(
      (m) => m.captureIds.length === captureIds.length && m.captureIds.every((id) => captureIds.includes(id))
    );
  const selectionValid = captureIds.length === 0 ? canDiscard : captureSelectionMatches;
  const canCommitSelection = canPlaySelected && selectionValid;

  const selectHand = (entry: Entry) => {
    setSelectedId(entry.id);
    const moves = rec?.moves.filter((m) => m.entry.id === entry.id && m.isCapture) ?? [];
    setCaptureIds(moves[0]?.captureIds ?? []);
  };

  const toggleTable = (id: string) => {
    if (myTurn) {
      if (!selectedEntry) return;
      setCaptureIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else if (pending) {
      setOpponentCaptureIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const startOpponentPlay = (input: PlayedInput) => {
    setPending(input);
    if (input.kind === 'rank') {
      const options = legalCaptures(game.table, rankValue(input.rank));
      setOpponentCaptureIds(options[0]?.map((e) => e.id) ?? []);
    } else {
      setOpponentCaptureIds([]);
    }
    setOpponentPicker(false);
  };

  const pendingKnownValue = pending?.kind === 'rank' ? rankValue(pending.rank) : null;
  const opponentOptions =
    pendingKnownValue !== null ? legalCaptures(game.table, pendingKnownValue) : [];

  const selectedOpponentCapture = opponentCaptureIds
    .map((id) => game.table.find((e) => e.id === id))
    .filter((e): e is Entry => Boolean(e));
  const opponentCaptureSum = captureTotal(selectedOpponentCapture);
  const inferredRank =
    pending?.kind === 'unknown' && selectedOpponentCapture.length
      ? valueToRank(15 - opponentCaptureSum)
      : null;

  const unknownHand = game.hand.find((e) => e.kind === 'unknown') ?? null;

  return (
    <div className="play">
      <div className="status-strip">
        <span>Deal {game.deal}/4</span>
        <span>{unseen} unseen</span>
        <span>{info}% resolved</span>
        <span className={game.table.length === 0 ? 'sweep-text' : ''}>
          {game.table.length === 0 ? 'Table clear' : `${game.table.length} on table`}
        </span>
      </div>

      <div className={`turn-banner ${myTurn ? 'mine' : ''}`}>
        <div>
          <small>{game.phase === 'finished' ? 'ROUND COMPLETE' : 'TURN'}</small>
          <strong>{myTurn ? 'Your turn' : `Player ${game.turn + 1}`}</strong>
        </div>
        <div className="player-dots" aria-hidden="true">
          {[0, 1, 2].map((p) => (
            <span key={p} className={`dot ${game.turn === p ? 'active' : ''}`} />
          ))}
        </div>
      </div>

      {enteringHand ? (
        <section className="panel hand-entry">
          <div className="panel-title">
            <h2>Enter your hand for deal {game.deal}</h2>
            <span>{game.hand.length} / 3</span>
          </div>
          <p className="hint">You can start analysing as soon as at least one card is entered.</p>
          <div className="card-row">
            {game.hand.map((entry) => (
              <CardTile
                key={entry.id}
                entry={entry}
                onClick={() => dispatch((g) => removeEntry(g, entry.id))}
              />
            ))}
            {game.hand.length < 3 ? (
              <button type="button" className="add-card" onClick={() => setHandPicker(true)}>
                +
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {handEscova ? (
        <section className="panel bonus">
          <div className="bonus-head">
            <span className="badge gold">HAND 15</span>
            <h2>Your three cards total 15</h2>
          </div>
          <p>
            This is a hand escova under the 3-card house rule. Declare it before playing if your table
            requires it. Scores are not tracked in this app.
          </p>
        </section>
      ) : null}

      {unknownHand ? (
        <section className="panel notice">
          <h2>Unknown card in your hand</h2>
          <p>
            Specify it to unlock recommendations for that card. Recommendations below still cover your
            other known cards.
          </p>
          <button type="button" className="secondary" onClick={() => setResolveId(unknownHand.id)}>
            Specify this card
          </button>
        </section>
      ) : null}

      {myTurn && rec && rec.best ? (
        <section className="panel recommendation">
          <div className="panel-title">
            <h2>Recommended move</h2>
            <span className="badge green">Best</span>
          </div>
          <div className="recommend-main">
            <CardTile entry={rec.best.entry} />
            <div>
              <h3>
                {rec.best.isCapture ? 'Capture with ' : 'Discard '}
                {entryShort(rec.best.entry)}
              </h3>
              <p className="capture-line">{captureText(rec.best)}</p>
              {rec.best.sweep ? <span className="badge gold">ESCOVA</span> : null}
            </div>
          </div>
          <ul className="reasons">
            {rec.best.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <div className="risk-row">
            <div>
              <small>Opponent capture risk</small>
              <div className={`meter ${threatClass(rec.best.threat.capture)}`}>
                <span style={{ width: `${Math.round(rec.best.threat.capture * 100)}%` }} />
              </div>
              <b>{Math.round(rec.best.threat.capture * 100)}%</b>
            </div>
            <div>
              <small>Opponent escova risk</small>
              <div className={`meter ${threatClass(rec.best.threat.escoba)}`}>
                <span style={{ width: `${Math.round(rec.best.threat.escoba * 100)}%` }} />
              </div>
              <b>{Math.round(rec.best.threat.escoba * 100)}%</b>
            </div>
          </div>
          <button
            type="button"
            className="primary wide"
            onClick={() => dispatch((g) => playCard(g, rec.best!.entry.id, rec.best!.captureIds))}
          >
            Play recommended move
          </button>
          <p className="hint">{rec.note}</p>

          {rec.moves.length > 1 ? (
            <div className="other-moves">
              <button type="button" className="collapse-head" onClick={() => setOtherMoves((v) => !v)}>
                <h3>Other legal moves ({rec.moves.length - 1})</h3>
                <span>{otherMoves ? '−' : '+'}</span>
              </button>
              {otherMoves
                ? rec.moves.slice(1).map((move) => (
                    <button
                      key={`${move.entry.id}-${move.captureIds.join('-')}`}
                      type="button"
                      className="alternative"
                      onClick={() => dispatch((g) => playCard(g, move.entry.id, move.captureIds))}
                    >
                      <span>{moveSummary(move)}</span>
                      <small>rating {move.score.toFixed(1)}</small>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-title">
          <h2>On the table</h2>
          <span>{game.table.length} cards</span>
        </div>
        <div className="card-row table-row">
          {game.table.length ? (
            game.table.map((entry) => {
              const active = myTurn ? captureIds.includes(entry.id) : opponentCaptureIds.includes(entry.id);
              return (
                <CardTile
                  key={entry.id}
                  entry={entry}
                  selected={active}
                  muted={!myTurn && !pending}
                  onClick={entry.kind === 'unknown' ? undefined : () => toggleTable(entry.id)}
                />
              );
            })
          ) : (
            <p className="empty">Table is clear — there is nothing to capture.</p>
          )}
        </div>
        {opponentCaptureIds.length > 0 ? (
          <p className="hint">Selected captured value: {opponentCaptureSum} (needs 15 total)</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Your hand</h2>
          <span>
            {game.hand.length} cards{total !== null ? ` · total ${total}` : ''}
          </span>
        </div>
        <div className="card-row hand-row">
          {game.hand.length ? (
            game.hand.map((entry) => (
              <CardTile
                key={entry.id}
                entry={entry}
                selected={selectedId === entry.id}
                onClick={() =>
                  entry.kind === 'unknown' ? setResolveId(entry.id) : myTurn ? selectHand(entry) : undefined
                }
              />
            ))
          ) : (
            <p className="empty">No cards in hand.</p>
          )}
        </div>

        {myTurn && selectedEntry ? (
          <div className="capture-choices">
            <p className="hint">
              Playing {entryShort(selectedEntry)}
              {playedValue !== null ? ` (value ${playedValue})` : ''}. Tap table cards to change the capture,
              or pick a combination:
            </p>
            <div className="chip-row">
              {captureOptions.map((move) => (
                <button
                  key={move.captureIds.join('-')}
                  type="button"
                  className={`chip ${captureIds.join('-') === move.captureIds.join('-') ? 'active' : ''}`}
                  onClick={() => setCaptureIds(move.captureIds)}
                >
                  {captureText(move)}
                  {move.sweep ? ' · ESCOVA' : ''}
                </button>
              ))}
              {canDiscard ? (
                <button
                  type="button"
                  className={`chip ${captureIds.length === 0 ? 'active' : ''}`}
                  onClick={() => setCaptureIds([])}
                >
                  No capture
                </button>
              ) : null}
              {!canPlaySelected ? (
                <span className="hint">
                  A capture is mandatory and this card cannot make 15. Choose another card.
                </span>
              ) : null}
              {captureIds.length > 0 && !captureSelectionMatches && selectedCaptureTotal !== null ? (
                <span className="hint">
                  Selected capture totals {selectedCaptureTotal} / 15. Add or remove table cards.
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="primary wide"
              disabled={!canCommitSelection}
              onClick={() => dispatch((g) => playCard(g, selectedEntry.id, captureIds))}
            >
              {captureIds.length
                ? `Play and capture ${captureIds.length} card${captureIds.length === 1 ? '' : 's'}`
                : 'Play without capture'}
            </button>
          </div>
        ) : null}
      </section>

      {!myTurn && game.phase === 'playing' ? (
        <section className="panel opponent-panel">
          <div className="panel-title">
            <h2>Record Player {game.turn + 1}'s play</h2>
            <span>{expectedPlaysThisDeal(game) - playsThisDeal(game, game.turn)} card(s) left</span>
          </div>
          {!pending ? (
            <>
              <p className="hint">
                Choose the rank you saw. If you did not see it, record 0 — a known capture will infer its
                value.
              </p>
              <button type="button" className="primary wide" onClick={() => setOpponentPicker(true)}>
                Enter opponent card
              </button>
            </>
          ) : (
            <>
              <div className="pending-play">
                <span>Played:</span>
                <CardTile
                  entry={
                    pending.kind === 'rank'
                      ? rankEntry(pending.rank, 'pending')
                      : unknownEntry('pending')
                  }
                  small
                />
                {pending.kind === 'unknown' && inferredRank !== null ? (
                  <span className="badge">inferred rank {inferredRank}</span>
                ) : null}
              </div>
              {opponentOptions.length ? (
                <div className="chip-row">
                  {opponentOptions.map((option) => (
                    <button
                      key={option.map((e) => e.id).join('-')}
                      type="button"
                      className={`chip ${opponentCaptureIds.join('-') === option.map((e) => e.id).join('-') ? 'active' : ''}`}
                      onClick={() => setOpponentCaptureIds(option.map((e) => e.id))}
                    >
                      {option.map((e) => entryShort(e)).join(' + ')}
                    </button>
                  ))}
                </div>
              ) : pending.kind === 'unknown' ? (
                <p className="hint">
                  Select the table cards they captured. The app will infer the played card's value from 15.
                </p>
              ) : (
                <p className="hint">No legal capture — confirm records this as a discard.</p>
              )}
              {pendingKnownValue !== null ? (
                <p className="hint">
                  Total: {pendingKnownValue + opponentCaptureSum} / 15
                  {pendingKnownValue + opponentCaptureSum !== 15 && opponentCaptureIds.length > 0
                    ? ' — this selection is not legal'
                    : ''}
                </p>
              ) : null}
              {pending.kind === 'unknown' && opponentCaptureIds.length > 0 ? (
                <p className="hint">
                  Inferred played card:{' '}
                  {inferredRank ? `rank ${inferredRank}` : 'not a valid card'}
                </p>
              ) : null}
              <div className="button-row">
                <button
                  type="button"
                  className="primary"
                  disabled={
                    (pendingKnownValue !== null &&
                      opponentOptions.length > 0 &&
                      opponentCaptureIds.length === 0) ||
                    (pendingKnownValue !== null &&
                      opponentCaptureIds.length > 0 &&
                      pendingKnownValue + opponentCaptureSum !== 15) ||
                    (pending.kind === 'unknown' &&
                      opponentCaptureIds.length > 0 &&
                      inferredRank === null)
                  }
                  onClick={() => dispatch((g) => recordOpponentPlay(g, pending, opponentCaptureIds))}
                >
                  Confirm play
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setPending(null);
                    setOpponentCaptureIds([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {unknownOnTable > 0 ? (
        <section className="panel notice">
          <h2>Unknown cards on the table: {unknownOnTable}</h2>
          <p>
            Recommendations still work around known cards. Resolve the unknown cards in the Cards tab when
            they become visible.
          </p>
        </section>
      ) : null}

      {advancing.ok ? (
        <section className="panel">
          <h2>Deal complete</h2>
          <p>All three hands are empty. Deal the next three cards each.</p>
          <button type="button" className="primary wide" onClick={() => dispatch(nextDeal)}>
            Start deal {game.deal + 1}
          </button>
        </section>
      ) : null}

      {finishing.ok ? (
        <section className="panel">
          <h2>Finish the round</h2>
          <p>The remaining table cards go to the last player who captured.</p>
          <button type="button" className="primary wide" onClick={() => dispatch(finishGame)}>
            Finish round
          </button>
        </section>
      ) : null}

      {game.phase === 'playing' && game.deal === 4 && !finishing.ok && game.hand.length === 0 && !advancing.ok ? (
        <section className="panel">
          <h2>Finish the round</h2>
          <p className="hint">{finishing.reason}</p>
        </section>
      ) : null}

      {opponentPicker ? (
        <RankPicker
          title={`Player ${game.turn + 1}: card played`}
          remaining={remaining}
          onPickRank={(rank) => startOpponentPlay({ kind: 'rank', rank })}
          onPickUnknown={() => startOpponentPlay({ kind: 'unknown' })}
          onClose={() => setOpponentPicker(false)}
        />
      ) : null}

      {handPicker ? (
        <RankPicker
          title={`Deal ${game.deal}: add a hand card`}
          remaining={remaining}
          onPickRank={(rank) => {
            if (dispatch((g) => addRankCard(g, 'hand', rank))) setHandPicker(false);
          }}
          onClose={() => setHandPicker(false)}
        />
      ) : null}

      {resolveId ? (
        <RankPicker
          title="Specify the unknown card"
          remaining={remaining}
          onPickRank={(rank) => {
            if (dispatch((g) => resolveEntry(g, resolveId, rank))) setResolveId(null);
          }}
          onClose={() => setResolveId(null)}
        />
      ) : null}
    </div>
  );
}
