import { Game } from '../tracking/state';

export const STORAGE_KEY = 'escova15-v3';
const MAX_HISTORY = 80;

interface Stored {
  version: 3;
  games: Game[];
}

function isValidGame(value: unknown): value is Game {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Partial<Game>;
  return (
    g.version === 2 &&
    Array.isArray(g.hand) &&
    Array.isArray(g.table) &&
    Array.isArray(g.captured) &&
    Array.isArray(g.turns) &&
    typeof g.phase === 'string'
  );
}

export function loadHistory(): Game[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored | Game[];
    if (Array.isArray(parsed)) {
      const games = parsed.filter(isValidGame);
      return games.length ? games.slice(-MAX_HISTORY) : [];
    }
    if (parsed?.version === 3 && Array.isArray(parsed.games)) {
      return parsed.games.filter(isValidGame).slice(-MAX_HISTORY);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveHistory(games: Game[]): void {
  try {
    const payload: Stored = { version: 3, games: games.slice(-MAX_HISTORY) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing; gameplay still works.
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
