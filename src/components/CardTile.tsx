import { Entry, entryShort } from '../game/entries';
import { SUIT_SYMBOL, cardValue } from '../game/cards';

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
  const suit = entry.kind === 'exact' ? entry.card.suit : null;
  const value = entry.kind === 'exact' ? cardValue(entry.card) : null;
  const classes = [
    'tile',
    suit ? `suit-${suit}` : 'suit-unknown',
    selected ? 'selected' : '',
    small ? 'small' : '',
    muted ? 'muted' : '',
    entry.kind === 'unknown' ? 'unknown' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const label =
    ariaLabel ??
    (entry.kind === 'exact'
      ? `${entry.card.rank} de ${suit}`
      : entry.kind === 'rank'
        ? `rank ${entry.rank}, suit unknown`
        : 'unknown card');

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
      <span className="tile-rank">{entryShort(entry)}</span>
      <span className="tile-suit">{suit ? SUIT_SYMBOL[suit] : '?'}</span>
      {value !== null && entry.kind === 'exact' && value !== entry.card.rank ? (
        <span className="tile-value">={value}</span>
      ) : null}
    </button>
  );
}
