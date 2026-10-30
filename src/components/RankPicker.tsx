import { RANKS, Rank, rankName, rankValue } from '../game/cards';
import { Sheet } from './Sheet';

interface Props {
  title: string;
  remaining: Map<Rank, number>;
  onPickRank: (rank: Rank) => void;
  onPickUnknown?: () => void;
  onClose: () => void;
}

export function RankPicker({ title, remaining, onPickRank, onPickUnknown, onClose }: Props) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="hint">
        Four copies of every rank. Remaining copies are shown on each button.
      </p>
      <div className="rank-grid">
        {RANKS.map((rank) => {
          const left = remaining.get(rank) ?? 0;
          return (
            <button
              key={rank}
              type="button"
              className="rank-key"
              disabled={left <= 0}
              onClick={() => onPickRank(rank)}
              aria-label={`${rankName(rank)}, ${left} remaining`}
            >
              <strong>{rank}</strong>
              <small>{left} left</small>
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
    </Sheet>
  );
}
