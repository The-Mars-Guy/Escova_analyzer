export interface ScoringConfig {
  /** Points per table-clearing escova. */
  escoba: number;
  /** Points for a 3-card hand totalling 15 (house rule). */
  handEscova: number;
  /** Points for the most captured cards. */
  mostCards: number;
  /** Points for the most oros captured. */
  mostOros: number;
  /** Points for the most sevens captured. */
  mostSevens: number;
  /** Points for capturing the 7 de oros. */
  sevenOfOros: number;
  /** Bonus for capturing every oro (10 cards). 0 disables. */
  allOros: number;
  /** Bonus for capturing every seven (4 cards). 0 disables. */
  allSevens: number;
  /** Bonus for la setenta (highest card of each suit, values 1-7). 0 disables. */
  seventy: number;
  /** If false, tied categories award nothing (standard). */
  awardTies: boolean;
  /** Automatically record the 3-card hand escova instead of asking. */
  autoHandEscova: boolean;
  /** Score needed to win. */
  targetScore: number;
}

export const HOUSE_CONFIG: ScoringConfig = {
  escoba: 1,
  handEscova: 3,
  mostCards: 1,
  mostOros: 1,
  mostSevens: 1,
  sevenOfOros: 1,
  allOros: 0,
  allSevens: 0,
  seventy: 0,
  awardTies: false,
  autoHandEscova: false,
  targetScore: 15
};

export const CLASSIC_CONFIG: ScoringConfig = {
  ...HOUSE_CONFIG,
  escoba: 1,
  handEscova: 0,
  allOros: 1,
  allSevens: 1,
  seventy: 0,
  targetScore: 21
};

export const BRAZILIAN_CONFIG: ScoringConfig = {
  ...HOUSE_CONFIG,
  handEscova: 0,
  mostSevens: 0,
  allOros: 2,
  allSevens: 0,
  targetScore: 31
};

export type PresetName = 'house' | 'classic' | 'brazilian';

export const PRESETS: Record<PresetName, { label: string; config: ScoringConfig }> = {
  house: { label: 'House rules (3-card = 3 pts)', config: HOUSE_CONFIG },
  classic: { label: 'Spanish Escoba', config: CLASSIC_CONFIG },
  brazilian: { label: 'Brazilian Escova', config: BRAZILIAN_CONFIG }
};

export function withConfig(base: ScoringConfig, patch: Partial<ScoringConfig>): ScoringConfig {
  return { ...base, ...patch };
}
