import { useState } from 'react';
import { ScoringConfig } from '../game/config';
import { PRESETS, PresetName } from '../game/config';
import {
  Game,
  Player,
  canFinish,
  computeScores,
  finishGame,
  setConfig,
  setPriorScore
} from '../tracking/state';

interface Props {
  game: Game;
  dispatch: (update: (current: Game) => Game) => boolean;
}

const NUMERIC_FIELDS: { key: keyof ScoringConfig; label: string }[] = [
  { key: 'escoba', label: 'Table escova' },
  { key: 'handEscova', label: '3-card hand escova' },
  { key: 'mostCards', label: 'Most cards' },
  { key: 'mostOros', label: 'Most oros' },
  { key: 'mostSevens', label: 'Most sevens' },
  { key: 'sevenOfOros', label: '7 de oros' },
  { key: 'allOros', label: 'All oros bonus' },
  { key: 'allSevens', label: 'All sevens bonus' },
  { key: 'seventy', label: 'La setenta' },
  { key: 'targetScore', label: 'Target score' }
];

export function ScoresScreen({ game, dispatch }: Props) {
  const [showConfig, setShowConfig] = useState(false);
  const result = computeScores(game);
  const finishing = canFinish(game);
  const leader = [...result.players].sort((a, b) => b.totalPoints - a.totalPoints)[0];

  const samePreset = (name: PresetName) => {
    const preset = PRESETS[name].config;
    return (Object.keys(preset) as (keyof ScoringConfig)[]).every((k) => preset[k] === game.config[k]);
  };

  return (
    <div className="scores">
      <div className="status-strip">
        <span>Deal {game.deal}/4</span>
        <span>{game.turns.length} turns</span>
        <span>Target {game.config.targetScore}</span>
        <span>{game.phase === 'finished' ? 'Finished' : 'In play'}</span>
      </div>

      <section className="panel">
        <div className="panel-title">
          <h2>Score estimate</h2>
          <span>Round + starting</span>
        </div>
        <div className="score-cards">
          {result.players.map((p) => (
            <div className={`score-card ${leader?.player === p.player ? 'leader' : ''}`} key={p.player}>
              <div className="score-head">
                <h3>{p.player === 0 ? 'You' : `Player ${p.player + 1}`}</h3>
                <strong>{p.totalPoints}</strong>
              </div>
              <p className="muted-small">
                {p.roundPoints} this round + {p.priorPoints} starting
              </p>
              <div className="score-stats">
                <span>{p.cards} cards</span>
                <span>{p.oros} oros</span>
                <span>{p.sevens} sevens</span>
                <span>{p.escobas} escobas</span>
                <span>{p.handEscovas} hand</span>
              </div>
              <ul>
                {p.lines.length ? (
                  p.lines.map((line) => (
                    <li key={line.label}>
                      <span>{line.label}</span>
                      <b>+{line.points}</b>
                    </li>
                  ))
                ) : (
                  <li className="muted">No points yet</li>
                )}
              </ul>
            </div>
          ))}
        </div>
        {result.notes.map((note) => (
          <p className="hint" key={note}>
            {note}
          </p>
        ))}
        <p className="hint">
          Remaining table cards go to the last player who captured. Opponent captures must be recorded for
          meaningful scores; unknown cards make suit-based points a lower bound.
        </p>
      </section>

      <section className="panel">
        <h2>Starting scores</h2>
        <div className="score-inputs">
          {( [0, 1, 2] as Player[]).map((p) => (
            <label key={p}>
              {p === 0 ? 'You' : `Player ${p + 1}`}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={game.priorScores[p]}
                onChange={(e) => dispatch((g) => setPriorScore(g, p, Number(e.target.value)))}
              />
            </label>
          ))}
        </div>
        <p className="hint">Use this when you join a game mid-round or start a new round with carried-over points.</p>
      </section>

      <section className="panel">
        <button type="button" className="collapse-head" onClick={() => setShowConfig((v) => !v)}>
          <h2>Scoring rules</h2>
          <span>{showConfig ? '−' : '+'}</span>
        </button>
        <div className="preset-row">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button
              key={name}
              type="button"
              className={`preset ${samePreset(name) ? 'active' : ''}`}
              onClick={() => dispatch((g) => setConfig(g, PRESETS[name].config))}
            >
              {PRESETS[name].label}
            </button>
          ))}
        </div>
        {showConfig ? (
          <>
            <div className="config-grid">
              {NUMERIC_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    type="number"
                    min={0}
                    value={game.config[field.key] as number}
                    onChange={(e) =>
                      dispatch((g) => setConfig(g, { [field.key]: Math.max(0, Number(e.target.value)) }))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={game.config.awardTies}
                onChange={(e) => dispatch((g) => setConfig(g, { awardTies: e.target.checked }))}
              />
              Award ties instead of no point
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={game.config.autoHandEscova}
                onChange={(e) => dispatch((g) => setConfig(g, { autoHandEscova: e.target.checked }))}
              />
              Record 3-card hand escova automatically
            </label>
            <p className="hint">
              Set a value to 0 to disable that category. Ties award nothing by default, as in standard Escoba.
            </p>
          </>
        ) : null}
      </section>

      {finishing.ok ? (
        <button type="button" className="primary wide" onClick={() => dispatch(finishGame)}>
          Finish round and lock scores
        </button>
      ) : (
        <p className="hint center">{finishing.reason}</p>
      )}
    </div>
  );
}
