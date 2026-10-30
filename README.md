# Escova 15 — Pocket Strategy Assistant

**Live app:** https://the-mars-guy.github.io/Escova_analyzer/

A mobile-first web assistant for the **physical** game Escova de 15 (Brazilian Escova / Spanish Escoba).
You play with real cards; the app tracks what is visible and recommends the best card to play.

It is not a digital version of the game. There is no backend and no account.

## Features

- Fast one-hand play UI: large cards, one-screen hand/table, bottom navigation.
- Start a fresh round (4 table cards + 3 hand cards) or **join mid-round** with only the visible
  information.
- Three levels of card knowledge:
  - exact card (rank + suit),
  - rank only (suit genuinely unknown),
  - completely unknown (`0`).
- Unknown opponent plays are inferred from known captures (value = 15 − captured total) without
  inventing a suit.
- Automatic tracking of your hand, the table, captures, dead cards and unresolved entries.
- Undo for every action; game state persists in the browser and survives reloads.
- Strategy engine:
  - enumerates every legal move (capture is mandatory when possible),
  - values escovas, oros, sevens, the 7 de oros, card count and preserving key cards,
  - runs a deterministic Monte Carlo simulation over plausible hidden-card layouts,
  - reports opponent capture / escova risk and an information-confidence note.
- Separate, duplicate-safe **3-card hand escova** detection (house rule, 3 points by default).
- Configurable scoring with presets (house, Spanish, Brazilian) and per-category values.
- Installable PWA with offline support.
- GitHub Pages deployment workflow.

## Rules implemented

Verified against the [Wikipedia rules](https://en.wikipedia.org/wiki/Escoba_del_15) and the MIT-licensed
[marianogappa/escoba](https://github.com/marianogappa/escoba) Go implementation:

- 40-card Spanish deck (no 8s or 9s), four suits: oros, copas, espadas, bastos.
- Values: 1–7 = face value, 10 = 8, 11 = 9, 12 = 10.
- 3 players, 3 cards each; 4 cards on the table; 4 deals exhaust the deck.
- A capture is the played card plus one or more table cards totalling exactly 15.
- **You must capture when a capture is available.**
- Clearing the whole table is an escova (1 point by default).
- Four opening table cards totalling 15 go to the dealer as an escova.
- Remaining table cards at the end go to the last player who captured.
- Standard scoring: most cards, most oros, most sevens, 7 de oros, all oros, all sevens, each escoba,
  optional la setenta. Ties award no point by default.
- House rule: three cards in your hand totalling 15 is a separate 3-point scoring event. It is detected
  automatically, requires an explicit declaration by default (or can auto-record), and cannot be
  recorded twice for the same hand.

## How to use it on a phone

### Local development

```bash
npm install
npm run dev
```

Open the printed LAN address on a phone connected to the same Wi-Fi. The PC must be running for this
mode.

`START-WINDOWS.bat` starts the same dev server and shows the LAN URL.

### Install / offline (recommended)

Deploy to GitHub Pages, open the URL on the phone once, then use **Add to Home Screen**. The PWA caches
the app and works offline without the PC running.

### GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs tests, builds, and deploys on every push to
   `main`.

Vite uses a relative base path (`base: './'`), so the app works at any repository sub-path and in local
preview without configuration.

### Production build

```bash
npm run build
npm run preview
```

Output is written to `dist/`.

## Testing

```bash
npm test        # game rules, tracking, scoring, strategy
npm run typecheck
```

The tests cover deck values, capture combinations, mandatory captures, escova detection, mid-round
setup, unknown-card inference, duplicate prevention, hand-escova duplicate protection, deal
progression, final table assignment, scoring ties and Monte Carlo determinism.

## Project structure

```
src/
  game/       cards, entries, legal moves, scoring, presets
  tracking/   game state, selectors, unknown/known accounting
  strategy/   move evaluation, Monte Carlo hidden-card simulation
  storage/    browser persistence
  components/ mobile UI
  ui/         state hook
```

All game logic is pure and testable. React components only translate taps into those functions.

## Unknown information model

Entries are immutable and have a stable id:

- `exact` — known rank and suit;
- `rank` — known rank, unknown suit (usually inferred from a capture);
- `unknown` — nothing known, displayed as `0`.

Exact duplicates are rejected. Unknown table cards cannot be captured (their value is unknown) and
prevent a table-clearing escova until resolved, but they never disable recommendations. Monte Carlo
samples plausible identities for every unresolved entry so probabilities stay meaningful.

## Scoring configuration

Open **Scores → Scoring rules**. Every category can be set to 0 to disable it. `awardTies` controls
whether tied majorities score. The default target is 15; Spanish Escoba commonly plays to 21 and
Brazilian Escova to 31.

## Limitations

- Opponent hands are hidden by design. Recommendations are probabilistic, not perfect.
- If you join mid-round, captures from before you joined are not reconstructed; enter starting scores
  if you need an accurate total.
- Suit-based bonuses are lower bounds when captured cards are unresolved.
- The Monte Carlo model assumes a uniform distribution of unseen cards; it does not model opponent
  tendencies.

## References and licences

- [marianogappa/escoba](https://github.com/marianogappa/escoba) — MIT. Rules reference; no code copied.
- [garroadran/quince](https://github.com/garroadran/quince) — MIT. Rules reference; no code copied.
- [GAIPS/sueca-solver](https://github.com/GAIPS/sueca-solver) — hidden-information techniques reference.
