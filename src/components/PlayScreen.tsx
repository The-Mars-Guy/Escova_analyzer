import { useEffect, useState } from 'react';
import { CardKey, SUIT_SYMBOL, cardValue, rankValue, valueToRank } from '../game/cards';
import { Entry, entryShort } from '../game/entries';
import { captureTotal, legalCaptures } from '../game/rules';
import {
  Game,
  PlayedInput,
  addCard,
  canAdvanceDeal,
  canFinish,
  declareHandEscova,
  expectedPlaysThisDeal,
  finishGame,
  handEscovaInfo,
  handTotal,
  nextDeal,
  playCard,
  playsThisDeal,
  recordOpponentPlay,
  removeEntry,
  resolveEntry
} from '../tracking/state';
import { informationPercent, unseenCount } from '../tracking/selectors';
import { MoveOption, Recommendation, moveSummary } from '../strategy/engine';
import { CardTile } from './CardTile';
import { DeckPicker } from './DeckPicker';

interface Props {
  game: Game;
  rec: Recommendation | null;
  used: Set<CardKey>;
  dispatch: (update: (current: Game) => Game) => boolean;
}

function captureText(move: MoveOption): string {
  if (!move.capture.length) return 'no capture';
  return move.capture
    .map((e) => (e.kind === 'exact' ? `${e.card.rank}${SUIT_SYMBOL[e.card.suit]}` : entryShort(e)))
    .join(' + ');
}

function threatClass(probability: number): string {
  if (probability >= 0.55) return 'high';
  if (probability >= 0.25) return 'medium';
  return 'low';
}

export function PlayScreen({ game, rec, used, dispatch }: Props) {
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
  const enteringHand = game.hand.length === 0 && playsThisDeal(game, 0) === 0 && game.phase === 'playing';
  const advancing = canAdvanceDeal(game);
  const finishing = canFinish(game);
  const info = informationPercent(game);
  const unseen = unseenCount(game);
  const unknownOnTable = game.table.filter((e) => e.kind === 'unknown').length;
  const handBonus = handEscovaInfo(game);

  const selectedEntry = game.hand.find((e) => e.id === selectedId) ?? null;
  const myMoves = rec && selectedEntry ? rec.moves.filter((m) => m.entry.id === selectedEntry.id) : [];
  const captureOptions = myMoves.filter((m) => m.isCapture);
  const canDiscard = myMoves.some((m) => !m.isCapture);
  const canPlaySelected = captureOptions.length > 0 || canDiscard;
  const playedValue = selectedEntry ? (selectedEntry.kind === 'exact' ? cardValue(selectedEntry.card) : selectedEntry.kind === 'rank' ? rankValue(selectedEntry.rank) : null) : null;
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
    if (input.kind === 'exact' || input.kind === 'rank') {
      const value = input.kind === 'exact' ? cardValue(input.card) : rankValue(input.rank);
      if (value !== null) {
        const options = legalCaptures(game.table, value);
        setOpponentCaptureIds(options[0]?.map((e) => e.id) ?? []);
      }
    } else {
      setOpponentCaptureIds([]);
    }
    setOpponentPicker(false);
  };

  const opponentOptions =
    pending && (pending.kind === 'exact' || pending.kind === 'rank')
      ? legalCaptures(
          game.table,
          pending.kind === 'exact' ? cardValue(pending.card) : rankValue(pending.rank)
        )
      : [];

  const pendingKnownValue =
    pending?.kind === 'exact'
      ? cardValue(pending.card)
      : pending?.kind === 'rank'
        ? rankValue(pending.rank)
        : null;

  const unknownCapture = opponentCaptureIds
    .map((id) => game.table.find((e) => e.id === id))
    .filter((e): e is Entry => Boolean(e));
  const unknownTotal = captureTotal(unknownCapture);
  const inferredRank = pending?.kind === 'unknown' && unknownCapture.length ? valueToRank(15 - unknownTotal) : null;

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

      {handBonus.possible && !handBonus.declared ? (
        <section className="panel bonus">
          <div className="bonus-head">
            <span className="badge gold">+{game.config.handEscova} PTS</span>
            <h2>Three-card escova in your hand</h2>
          </div>
          <p>
            Your hand totals 15. Under your house rule this is a separate scoring event worth{' '}
            {game.config.handEscova} point{game.config.handEscova === 1 ? '' : 's'} — declare it before you
            start playing this hand.
          </p>
          <button type="button" className="primary" onClick={() => dispatch(declareHandEscova)}>
            Declare hand escova
          </button>
          <p className="hint">
            This is not the same as a table-clearing escova. It can only be recorded once per hand.
          </p>
        </section>
      ) : null}

      {handBonus.possible && handBonus.declared ? (
        <section className="panel bonus recorded">
          <span className="badge gold">RECORDED</span>
          <p>Hand escova recorded for this hand ({game.config.handEscova} pts).</p>
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
                {rec.best.isCapture ? 'Capture' : 'Discard'} {rec.best.card ? `${rec.best.card.rank} ${rec.best.card.suit}` : ''}
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
                      <small>score {move.score.toFixed(1)}</small>
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
            <p className="empty">Table is clear — play any card to keep the escova.</p>
          )}
        </div>
        {unknownTotal > 0 || (pending?.kind === 'unknown' && opponentCaptureIds.length) ? (
          <p className="hint">Selected captured value: {unknownTotal} (needs 15 total)</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Your hand</h2>
          <span>{game.hand.length} cards{handTotal(game.hand) !== null ? ` · total ${handTotal(game.hand)}` : ''}</span>
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
                Choose the card you saw. If you did not see it, record 0 — a known capture will infer its
                value without inventing a suit.
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
                    pending.kind === 'exact'
                      ? { id: 'p', kind: 'exact', card: pending.card }
                      : pending.kind === 'rank'
                        ? { id: 'p', kind: 'rank', rank: pending.rank }
                        : { id: 'p', kind: 'unknown' }
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
                      {option
                        .map((e) => (e.kind === 'exact' ? `${e.card.rank}${SUIT_SYMBOL[e.card.suit]}` : entryShort(e)))
                        .join(' + ')}
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
                  Total: {pendingKnownValue + unknownTotal} / 15
                  {pendingKnownValue + unknownTotal !== 15 && opponentCaptureIds.length > 0
                    ? ' — this selection is not legal'
                    : ''}
                </p>
              ) : null}
              {pending.kind === 'unknown' && opponentCaptureIds.length > 0 ? (
                <p className="hint">
                  Inferred played card: {inferredRank ? `rank ${inferredRank} (suit unknown)` : 'not a valid card'}
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
                      pendingKnownValue + unknownTotal !== 15) ||
                    (pending.kind === 'unknown' && opponentCaptureIds.length > 0 && inferredRank === null)
                  }
                  onClick={() => dispatch((g) => recordOpponentPlay(g, pending, opponentCaptureIds))}
                >
                  Confirm play
                </button>
                <button type="button" className="ghost" onClick={() => { setPending(null); setOpponentCaptureIds([]); }}>
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
            Recommendations still work around known cards. Resolve the unknown cards in the Tracker when
            they become visible so probabilities tighten.
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
            Finish and score
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
        <DeckPicker
          title={`Player ${game.turn + 1}: card played`}
          used={used}
          onPickCard={(card) => startOpponentPlay({ kind: 'exact', card })}
          onPickRank={(rank) => startOpponentPlay({ kind: 'rank', rank })}
          onPickUnknown={() => startOpponentPlay({ kind: 'unknown' })}
          onClose={() => setOpponentPicker(false)}
        />
      ) : null}

      {handPicker ? (
        <DeckPicker
          title={`Deal ${game.deal}: add a hand card`}
          used={used}
          onPickCard={(card) => {
            if (dispatch((g) => addCard(g, 'hand', card))) setHandPicker(false);
          }}
          onClose={() => setHandPicker(false)}
        />
      ) : null}

      {resolveId ? (
        <DeckPicker
          title="Specify the unknown card"
          used={used}
          onPickCard={(card) => {
            if (dispatch((g) => resolveEntry(g, resolveId, card))) setResolveId(null);
          }}
          onClose={() => setResolveId(null)}
        />
      ) : null}
    </div>
  );
}
