import { useState } from 'react';
import { CardKey } from '../game/cards';
import { Entry } from '../game/entries';
import { tableSum } from '../game/rules';
import { PRESETS, PresetName } from '../game/config';
import {
  Game,
  Player,
  addCard,
  addUnknownToTable,
  claimInitialEscova,
  removeEntry,
  setConfig,
  setDeal,
  setMidRound,
  setOpponentStartHand,
  setPriorScore,
  setTurn,
  startGame
} from '../tracking/state';
import { CardTile } from './CardTile';
import { DeckPicker } from './DeckPicker';

interface Props {
  game: Game;
  used: Set<CardKey>;
  dispatch: (update: (current: Game) => Game) => boolean;
}

export function SetupScreen({ game, used, dispatch }: Props) {
  const [picker, setPicker] = useState<'hand' | 'table' | null>(null);
  const [dealer, setDealer] = useState<Player>(0);
  const [showScores, setShowScores] = useState(false);

  const sum = tableSum(game.table);
  const freshReady =
    !game.midRound &&
    game.hand.length === 3 &&
    (game.table.length === 4 || (game.claimedInitial && game.table.length === 0));
  const midReady = game.midRound && game.hand.length <= 3;
  const ready = game.midRound ? midReady : freshReady;

  const choosePreset = (name: PresetName) => {
    dispatch((g) => setConfig(g, PRESETS[name].config));
  };

  const isPreset = (name: PresetName) =>
    JSON.stringify(game.config) === JSON.stringify(PRESETS[name].config);

  const zoneCards = (entries: Entry[]) =>
    entries.map((entry) => (
      <CardTile key={entry.id} entry={entry} onClick={() => dispatch((g) => removeEntry(g, entry.id))} />
    ));

  return (
    <div className="setup">
      <div className="mode-toggle big">
        <button
          type="button"
          className={!game.midRound ? 'active' : ''}
          onClick={() => dispatch((g) => setMidRound(g, false))}
        >
          New round
        </button>
        <button
          type="button"
          className={game.midRound ? 'active' : ''}
          onClick={() => dispatch((g) => setMidRound(g, true))}
        >
          Join mid-round
        </button>
      </div>

      {game.midRound ? (
        <p className="hint">
          Enter the table as it looks now and only the cards currently in your hand. You never need to
          reconstruct the whole round.
        </p>
      ) : (
        <p className="hint">
          Fresh deal: 4 cards on the table, 3 in your hand. If the four table cards total 15, the dealer
          takes them as an escova.
        </p>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>On the table</h2>
          <span>{game.table.length}{game.midRound ? '' : ' / 4'}</span>
        </div>
        <div className="card-row">
          {game.table.length ? zoneCards(game.table) : <p className="empty">Tap below to add table cards.</p>}
        </div>
        {(game.midRound || game.table.length < 4) && !game.claimedInitial ? (
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setPicker('table')}>
              + Table card
            </button>
            <button type="button" className="ghost" onClick={() => dispatch(addUnknownToTable)}>
              + Unknown 0
            </button>
          </div>
        ) : null}
        {!game.midRound && sum === 15 && game.table.length === 4 ? (
          <div className="notice gold">
            <strong>These four cards total 15.</strong>
            <p>The dealer takes them as a 1-point escova and play starts with an empty table.</p>
            <div className="button-row">
              <select
                value={dealer}
                onChange={(e) => setDealer(Number(e.target.value) as Player)}
                aria-label="Dealer"
              >
                <option value={0}>You</option>
                <option value={1}>Player 2</option>
                <option value={2}>Player 3</option>
              </select>
              <button
                type="button"
                className="secondary"
                onClick={() => dispatch((g) => claimInitialEscova(g, dealer))}
              >
                Give escova to dealer
              </button>
            </div>
          </div>
        ) : null}
        {game.claimedInitial ? (
          <p className="hint ok">Opening escova recorded. The table starts empty.</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Your hand</h2>
          <span>{game.hand.length} / 3</span>
        </div>
        <div className="card-row">
          {game.hand.length ? zoneCards(game.hand) : <p className="empty">Add the cards in your hand.</p>}
        </div>
        {game.hand.length < 3 ? (
          <button type="button" className="secondary" onClick={() => setPicker('hand')}>
            + Hand card
          </button>
        ) : null}
        <p className="hint">
          Tap a card to remove it. You can enter fewer than three cards when joining mid-round; unknown
          information never blocks play.
        </p>
      </section>

      <section className="panel compact-grid">
        <label>
          Whose turn?
          <select
            value={game.turn}
            onChange={(e) => dispatch((g) => setTurn(g, Number(e.target.value) as Player))}
          >
            <option value={0}>You</option>
            <option value={1}>Player 2</option>
            <option value={2}>Player 3</option>
          </select>
        </label>
        <label>
          Current deal
          <select value={game.deal} onChange={(e) => dispatch((g) => setDeal(g, Number(e.target.value)))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} of 4
              </option>
            ))}
          </select>
        </label>
        {game.midRound ? (
          <label>
            Cards in each opponent hand
            <select
              value={game.opponentStartHand}
              onChange={(e) => dispatch((g) => setOpponentStartHand(g, Number(e.target.value)))}
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="panel">
        <button type="button" className="collapse-head" onClick={() => setShowScores((v) => !v)}>
          <h2>Starting scores</h2>
          <span>{showScores ? '−' : '+'}</span>
        </button>
        {showScores ? (
          <div className="score-inputs">
            {[0, 1, 2].map((p) => (
              <label key={p}>
                {p === 0 ? 'You' : `Player ${p + 1}`}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={game.priorScores[p]}
                  onChange={(e) => dispatch((g) => setPriorScore(g, p as Player, Number(e.target.value)))}
                />
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Scoring preset</h2>
        <div className="preset-row">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button
              key={name}
              type="button"
              className={`preset ${isPreset(name) ? 'active' : ''}`}
              onClick={() => choosePreset(name)}
            >
              {PRESETS[name].label}
            </button>
          ))}
        </div>
        <p className="hint">
          3-card hand escova is worth {game.config.handEscova} point
          {game.config.handEscova === 1 ? '' : 's'} in this preset. All scoring values can be edited in the
          Scores tab.
        </p>
      </section>

      <button
        type="button"
        className="primary sticky-action"
        disabled={!ready}
        onClick={() => dispatch(startGame)}
      >
        {game.midRound ? 'Analyse current position' : 'Start round'}
      </button>
      {!ready ? (
        <p className="hint center">
          {game.midRound
            ? 'Enter at least the hand/table information you have.'
            : game.claimedInitial
              ? 'Add your three hand cards to start.'
              : 'Add four table cards and three hand cards to start.'}
        </p>
      ) : null}

      {picker ? (
        <DeckPicker
          title={picker === 'hand' ? 'Add a card to your hand' : 'Add a table card'}
          used={used}
          onPickCard={(card) => {
            if (dispatch((g) => addCard(g, picker, card))) setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

