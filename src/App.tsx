import { useMemo, useState } from 'react';
import { useGame } from './ui/useGame';
import { usedExactKeysWithDead } from './tracking/state';
import { recommend } from './strategy/engine';
import { SetupScreen } from './components/SetupScreen';
import { PlayScreen } from './components/PlayScreen';
import { TrackerScreen } from './components/TrackerScreen';
import { ScoresScreen } from './components/ScoresScreen';

type Tab = 'play' | 'tracker' | 'scores';

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'tracker', label: 'Cards' },
  { id: 'scores', label: 'Scores' }
];

export function App() {
  const { game, commit, undo, reset, canUndo, error, clearError } = useGame();
  const [tab, setTab] = useState<Tab>('play');
  const [confirmReset, setConfirmReset] = useState(false);

  const used = useMemo(() => usedExactKeysWithDead(game), [game]);

  const rec = useMemo(() => {
    if (game.phase !== 'playing' || game.turn !== 0) return null;
    if (game.hand.some((e) => e.kind === 'unknown')) return null;
    return recommend(game, { seed: game.updatedAt % 2147483647 });
  }, [game]);

  const newGame = () => {
    reset();
    setTab('play');
    setConfirmReset(false);
  };

  return (
    <div className="app">
      <header>
        <div>
          <p className="eyebrow">BARAJA ESPAÑOLA · 3 PLAYERS</p>
          <h1>
            Escova <em>15</em>
          </h1>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo">
            ↶
          </button>
          <button type="button" className="ghost small" onClick={() => setConfirmReset(true)}>
            New
          </button>
        </div>
      </header>

      {confirmReset ? (
        <div className="sheet-backdrop" onClick={() => setConfirmReset(false)} role="presentation">
          <div className="sheet pop" role="dialog" aria-modal="true" aria-label="Start a new game">
            <h2>Start a new game?</h2>
            <p className="hint">This clears the saved game and all undo history on this device.</p>
            <div className="button-row">
              <button type="button" className="primary" onClick={newGame}>
                Start new game
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main>
        {game.phase === 'setup' ? (
          <SetupScreen game={game} used={used} dispatch={commit} />
        ) : tab === 'play' ? (
          <PlayScreen game={game} rec={rec} used={used} dispatch={commit} />
        ) : tab === 'tracker' ? (
          <TrackerScreen game={game} used={used} dispatch={commit} />
        ) : (
          <ScoresScreen game={game} dispatch={commit} />
        )}
      </main>

      {game.phase !== 'setup' ? (
        <nav className="bottom-nav" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}

      <footer>
        <span>Saved on this device</span>
        <span>Works offline</span>
      </footer>

      {error ? (
        <button type="button" className="toast" role="alert" onClick={clearError}>
          {error} <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
