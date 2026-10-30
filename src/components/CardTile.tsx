import { entryShort } from '../game/entries';
import { Rank, rankValue } from '../game/cards';
import { Entry } from '../game/entries';

interface Props {
  entry: Entry;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  muted?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function CardTile({ entry, selected, disabled, small, muted, onClick, ariaLabel }: Props) {
  const unknown = entry.kind === 'unknown';
  const rank: Rank | null = entry.kind === 'rank' ? entry.rank : null;
  const value = rank !== null ? rankValue(rank) : null;
  const classes = [
    'tile',
    unknown ? 'unknown-card' : 'rank-card',
    selected ? 'selected' : '',
    small ? 'small' : '',
    muted ? 'muted' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const label =
    ariaLabel ?? (unknown ? 'unknown card' : `${rank}${value !== rank ? ` (value ${value})` : ''}`);

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
    >
      <span className="tile-rank">{unknown ? '0' : entryShort(entry)}</span>
      {!unknown && value !== null && value !== rank ? <span className="tile-value">={value}</span> : null}
      <span className="tile-mark">{unknown ? '?' : '•'}</span>
    </button>
  );
}
