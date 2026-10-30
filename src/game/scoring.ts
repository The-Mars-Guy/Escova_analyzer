import { ScoringConfig } from './config';
import { Entry, entryCard } from './entries';
import { Card, rankValue } from './cards';

export interface ScoreLine {
  label: string;
  points: number;
}

export interface PlayerScore {
  player: number;
  cards: number;
  oros: number;
  sevens: number;
  escobas: number;
  handEscovas: number;
  hasSevenOfOros: boolean;
  hasAllOros: boolean;
  hasAllSevens: boolean;
  seventy: number;
  lines: ScoreLine[];
  roundPoints: number;
  priorPoints: number;
  totalPoints: number;
}

export interface ScoringInput {
  captured: Entry[][];
  sweeps: number[];
  handBonus: number[];
  priorScores: number[];
  config: ScoringConfig;
}

export interface ScoringResult {
  players: PlayerScore[];
  uncertain: boolean;
  notes: string[];
}

function exactCards(entries: Entry[]): Card[] {
  return entries.map(entryCard).filter((c): c is Card => c !== null);
}

function countOros(entries: Entry[]): number {
  return exactCards(entries).filter((c) => c.suit === 'oros').length;
}

function countSevens(entries: Entry[]): number {
  return exactCards(entries).filter((c) => c.rank === 7).length;
}

export function seventyScore(entries: Entry[]): number {
  const best = new Map<string, number>();
  for (const card of exactCards(entries)) {
    const v = rankValue(card.rank);
    if (v > 7) continue;
    const prev = best.get(card.suit);
    if (prev === undefined || v > prev) best.set(card.suit, v);
  }
  if (best.size < 4) return 0;
  return [...best.values()].reduce((a, b) => a + b, 0);
}

function leaders(values: number[]): number[] {
  const max = Math.max(...values);
  if (max <= 0) return [];
  return values.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
}

export function scoreRound(input: ScoringInput): ScoringResult {
  const { captured, sweeps, handBonus, priorScores, config } = input;
  const playerCount = captured.length;
  const cards = captured.map((pile) => pile.length);
  const oros = captured.map(countOros);
  const sevens = captured.map(countSevens);
  const sevenOfOros = captured.map((pile) =>
    pile.some((e) => {
      const c = entryCard(e);
      return c !== null && c.suit === 'oros' && c.rank === 7;
    })
  );
  const allOros = captured.map((pile) => countOros(pile) === 10);
  const allSevens = captured.map((pile) => countSevens(pile) === 4);
  const seventyScores = captured.map(seventyScore);

  const categoryLeaders = {
    cards: leaders(cards),
    oros: leaders(oros),
    sevens: leaders(sevens),
    seventy: leaders(seventyScores)
  };
  const winsCategory = (list: number[], player: number) =>
    list.includes(player) && (list.length === 1 || config.awardTies);

  const players: PlayerScore[] = [];
  for (let i = 0; i < playerCount; i += 1) {
    const lines: ScoreLine[] = [];
    const add = (label: string, points: number) => {
      if (points !== 0) lines.push({ label, points });
    };

    if (sweeps[i] > 0 && config.escoba !== 0) {
      add(`Escobas ×${sweeps[i]}`, sweeps[i] * config.escoba);
    }
    if (handBonus[i] > 0 && config.handEscova !== 0) {
      add(`Hand escova ×${handBonus[i]}`, handBonus[i] * config.handEscova);
    }
    if (winsCategory(categoryLeaders.cards, i)) add('Most cards', config.mostCards);
    if (winsCategory(categoryLeaders.oros, i)) add('Most oros', config.mostOros);
    if (winsCategory(categoryLeaders.sevens, i)) add('Most sevens', config.mostSevens);
    if (sevenOfOros[i]) add('7 de oros', config.sevenOfOros);
    if (allOros[i]) add('All oros', config.allOros);
    if (allSevens[i]) add('All sevens', config.allSevens);
    if (seventyScores[i] > 0 && winsCategory(categoryLeaders.seventy, i)) {
      add(`La setenta (${seventyScores[i]})`, config.seventy);
    }

    const roundPoints = lines.reduce((sum, line) => sum + line.points, 0);
    const priorPoints = priorScores[i] ?? 0;
    players.push({
      player: i,
      cards: cards[i],
      oros: oros[i],
      sevens: sevens[i],
      escobas: sweeps[i],
      handEscovas: handBonus[i],
      hasSevenOfOros: sevenOfOros[i],
      hasAllOros: allOros[i],
      hasAllSevens: allSevens[i],
      seventy: seventyScores[i],
      lines,
      roundPoints,
      priorPoints,
      totalPoints: priorPoints + roundPoints
    });
  }

  const notes: string[] = [];
  const uncertain = captured.some((pile) => pile.some((e) => e.kind !== 'exact'));
  if (uncertain) {
    notes.push('Some captured cards are unknown, so oros/sevens totals and bonuses are lower bounds.');
  }
  const tied = Object.values(categoryLeaders).some((list) => list.length > 1);
  if (!config.awardTies && tied) {
    notes.push('A category is tied, so no point is awarded for it.');
  }

  return { players, uncertain, notes };
}
