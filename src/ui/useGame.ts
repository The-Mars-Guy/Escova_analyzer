import { useCallback, useState } from 'react';
import { Game, initialGame } from '../tracking/state';
import { clearHistory, loadHistory, saveHistory } from '../storage/persist';

export interface GameStore {
  game: Game;
  commit: (update: (game: Game) => Game) => boolean;
  undo: () => void;
  reset: () => void;
  canUndo: boolean;
  error: string;
  clearError: () => void;
}

export function useGame(): GameStore {
  const [history, setHistory] = useState<Game[]>(() => {
    const stored = loadHistory();
    return stored.length ? stored : [initialGame()];
  });
  const [error, setError] = useState('');

  const game = history[history.length - 1];

  const commit = useCallback(
    (update: (current: Game) => Game) => {
      try {
        const next = update(game);
        setHistory((prev) => {
          const merged = [...prev, next].slice(-80);
          saveHistory(merged);
          return merged;
        });
        setError('');
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [game]
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const merged = prev.slice(0, -1);
      saveHistory(merged);
      return merged;
    });
    setError('');
  }, []);

  const reset = useCallback(() => {
    const fresh = initialGame();
    clearHistory();
    saveHistory([fresh]);
    setHistory([fresh]);
    setError('');
  }, []);

  return {
    game,
    commit,
    undo,
    reset,
    canUndo: history.length > 1,
    error,
    clearError: () => setError('')
  };
}
