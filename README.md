# Escova 15 — Pocket Strategy Assistant

**Live app:** https://the-mars-guy.github.io/Escova_analyzer/

A mobile-first web assistant for the **physical** game Escova de 15. You play with real cards; the app
tracks what is visible and recommends the best card to play.

This version uses **rank-only input**: suits are not tracked and scores are not kept. Each rank has four
copies, so the app only needs the numbers. This makes setup and turn recording much faster.

## Features

- Rank-only entry: ten rank buttons with a live remaining-copy count (max 4 per rank).
- Fast one-hand play UI: large cards, one-screen hand/table, bottom navigation.
- Start a fresh round (4 table cards + 3 hand cards) or **join mid-round** with only visible information.
- Unknown cards: record `0` for a card you did not see. A known capture infers the played rank from 15.
- Automatic tracking of your hand, the table, captures, seen cards and unresolved entries.
- Undo for every action; the game persists in the browser and survives reloads.
- Strategy engine:
  - enumerates every legal move (capturing is mandatory when possible),
  - values captures, escovas, cards taken and the resulting table,
  - runs a deterministic Monte Carlo simulation over plausible hidden-card layouts,
  - reports opponent capture / escova risk and an information-confidence note.
- Detects a three-card hand totalling 15 and shows it as a hand-escova opportunity.
- Installable PWA with offline support.
- GitHub Pages deployment workflow.

## Rules implemented

Verified against the [Wikipedia rules](https://en.wikipedia.org/wiki/Escoba_del_15) and the MIT-licensed
[marianogappa/escoba](https://github.com/marianogappa/escoba) Go implementation:

- 40 cards: ranks 1–7, 10, 11, 12, four copies of each.
- Values: 1–7 = face value, 10 = 8, 11 = 9, 12 = 10.
- 3 players, 3 cards each; 4 cards on the table; 4 deals exhaust the deck.
- A capture is the played card plus one or more table cards totalling exactly 15.
- **You must capture when a capture is available.**
- Clearing the whole table is an escova.
- Four opening table cards totalling 15 go to the dealer as an escova.
- Remaining table cards at the end go to the last player who captured.
- A three-card hand totalling 15 is flagged as a hand escova (3-point house rule). Scores are not
  tracked, so the app only highlights the opportunity.

## How to use it on a phone

### Local development

```bash
npm install
npm run dev
```

Open the printed LAN address on a phone connected to the same Wi-Fi. The PC must be running for this
mode. `START-WINDOWS.bat` starts the same dev server.

### Install / offline (recommended)

Open the deployed GitHub Pages URL on the phone once, then use **Add to Home Screen**. The PWA caches the
app and works offline without the PC running.

### GitHub Pages

Pages is configured to deploy from GitHub Actions. The workflow in `.github/workflows/deploy.yml` runs
tests, builds, and deploys on every push to `main`. Vite uses a relative base path, so it works at any
repository sub-path.

### Production build

```bash
npm run build
npm run preview
```

Output is written to `dist/`.

## Testing

```bash
npm test        # rules, tracking, unknown inference, strategy
npm run typecheck
```

The tests cover rank values and copy limits, capture combinations, mandatory captures, escova detection,
mid-round setup, unknown-card inference, seen-copy tracking, deal progression, final table assignment,
strategy selection and Monte Carlo determinism.

## Project structure

```
src/
  game/       ranks, entries, legal moves
  tracking/   game state, selectors, unknown/seen accounting
  strategy/   move evaluation, Monte Carlo hidden-card simulation
  storage/    browser persistence
  components/ mobile UI
  ui/         state hook
```

All game logic is pure and testable. React components only translate taps into those functions.

## Unknown information model

Entries are immutable and have a stable id:

- `rank` — the number is known (suits are irrelevant in this app);
- `unknown` — nothing known, displayed as `0`.

A rank cannot exceed four accounted copies across the hand, table, captured piles and “seen earlier”
marks. Unknown table cards cannot be captured and prevent a table-clearing escova until resolved, but
they never disable recommendations. Monte Carlo samples plausible identities for every unknown entry so
probabilities stay meaningful.

## Limitations

- Opponent hands are hidden by design. Recommendations are probabilistic, not perfect.
- Scores and suits are intentionally not tracked in this version.
- If you join mid-round, captures from before you joined are not reconstructed.
- The Monte Carlo model assumes a uniform distribution of unseen cards; it does not model opponent
  tendencies.

## References and licences

- [marianogappa/escoba](https://github.com/marianogappa/escoba) — MIT. Rules reference; no code copied.
- [garroadran/quince](https://github.com/garroadran/quince) — MIT. Rules reference; no code copied.
- [GAIPS/sueca-solver](https://github.com/GAIPS/sueca-solver) — hidden-information techniques reference.
