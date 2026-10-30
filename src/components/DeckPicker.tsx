import { useState } from 'react';
import { Card, CardKey, RANKS, Rank, SUITS, SUIT_LABEL, SUIT_SYMBOL, rankValue, valueToRank } from '../game/cards';
import { Sheet } from './Sheet';

interface Props {
  title: string;
  used: Set<CardKey>;
  onPickCard?: (card: Card) => void;
  onPickRank?: (rank: Rank) => void;
  onPickUnknown?: () => void;
  onClose: () => void;
}

export function DeckPicker({ title, used, onPickCard, onPickRank, onPickUnknown, onClose }: Props) {
  const [suit, setSuit] = useState<(typeof SUITS)[number]>('oros');
  const [rankMode, setRankMode] = useState(false);

  const choose = (rank: Rank) => {
    if (rankMode && onPickRank) {
      onPickRank(rank);
      return;
    }
    if (onPickCard) onPickCard({ suit, rank });
  };

  return (
    <Sheet title={title} onClose={onClose}>
      {onPickRank ? (
        <div className="mode-toggle">
          <button
            type="button"
            className={!rankMode ? 'active' : ''}
            onClick={() => setRankMode(false)}
          >
            Exact card
          </button>
          <button type="button" className={rankMode ? 'active' : ''} onClick={() => setRankMode(true)}>
            Rank only
          </button>
        </div>
      ) : null}

      {!rankMode ? (
        <div className="suit-tabs" role="tablist" aria-label="Suit">
          {SUITS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={suit === s}
              className={`suit-tab suit-${s} ${suit === s ? 'active' : ''}`}
              onClick={() => setSuit(s)}
            >
              <span>{SUIT_SYMBOL[s]}</span>
              {SUIT_LABEL[s]}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">Pick the rank. The app will not invent a suit.</p>
      )}

      <div className="rank-grid">
        {RANKS.map((rank) => {
          const key = `${suit}-${rank}` as CardKey;
          const disabled = !rankMode && used.has(key);
          return (
            <button
              key={rank}
              type="button"
              className={`rank-key suit-${rankMode ? 'unknown' : suit}`}
              disabled={disabled}
              onClick={() => choose(rank)}
            >
              <strong>{rank}</strong>
              <small>{rankMode ? '?' : SUIT_SYMBOL[suit]}</small>
              {rankValue(rank) !== rank ? <em>= {rankValue(rank)}</em> : null}
            </button>
          );
        })}
      </div>

      {onPickUnknown ? (
        <button type="button" className="wide ghost" onClick={onPickUnknown}>
          0 · I did not see the card
        </button>
      ) : null}

      {onPickRank && !rankMode ? (
        <p className="hint">
          Only use “rank only” when you saw the number but not the suit. Inferred ranks from a capture are
          recorded automatically.
        </p>
      ) : null}
    </Sheet>
  );
}

export function inferRankFromCapture(total: number): Rank | null {
  return valueToRank(15 - total);
}
