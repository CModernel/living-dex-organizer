# Living Dex Organizer

Tool for organizing a Pokémon Living Dex: which Pokémon (including regional forms,
gender variants, and special forms) belong to each collection tier, built from a static
dataset generated from PokéAPI.

## Current status

Today the repo is the **data pipeline**: scripts that generate and validate the
dataset. The app itself (marking Pokémon as owned/not owned, UI) doesn't exist yet —
see [`TODO.md`](./TODO.md).

## Structure

```text
data/                     Generated dataset (source of truth for the app)
scripts/                  Generation/validation/normalization pipeline
sheets/                   Reference sheets (generic format, see docs/GUIDE.md)
sheets/raw/               Original vendor sheets (untracked, see .gitignore)
docs/                     Architecture and rules documentation
TODO.md                   Known pending tasks
```

## Dataset

- **`data/living-form-full-data.json`** — canonical dataset: every Pokémon/form
  included in the Living Dex, with types, sprites (derived from PokéAPI), and filter
  metadata (`evolutionStage`, `isAlternateForm`, `isGenderVariant`, `isRegionalForm`,
  `hasStatOrTypeDifference`). Regenerated with
  `node scripts/generate-living-form-full.js`.
- **`data/living-form-full-mapping-report.json`** — diagnostic report from the
  generator's last run (unmatched rows, orphan candidates). Regenerated alongside the
  dataset, not hand-edited.

Each entry is uniquely identified by its `slug` (the PokéAPI slug, e.g.
`"alcremie-a"`) and by `sortIndex` (global order 0..N). The `dex` field (National
Pokédex number) is **not** unique on its own — alternate forms of the same species
share the same `dex`.

## How it's built

1. **`sheets/*.csv`** — reference sheets in a generic format
   (`dex,name,formName,genderSuffix,keyword`), normalized from the original vendor sheet
   via `scripts/normalize-sheet.js` (see [`docs/GUIDE.md`](./docs/GUIDE.md) for the form
   inclusion/exclusion rules).
2. **`node scripts/generate-living-form-full.js`** — maps `sheets/Living Form Full.csv`
   1:1 against PokéAPI and writes `data/living-form-full-data.json` +
   `data/living-form-full-mapping-report.json`. Caches PokéAPI responses in
   `scripts/.pokeapi-*-cache.json` (untracked) because a full run takes several
   minutes.
3. **`node scripts/verify.js`** — verifies the generated dataset is semantically
   consistent and that, filtered by metadata, it exactly reproduces each of the other
   reference sheets (Living Form, Living Lite, Final Form Full, Final Form). Doesn't
   run automatically — no CI is set up yet (see `TODO.md`).

## Documentation

- [`docs/PLANNING.md`](./docs/PLANNING.md) — product architecture: separation between
  the static dataset and user state, storage roadmap (localStorage → Supabase).
- [`docs/RULES.md`](./docs/RULES.md) — mandatory rules for any AI/assistant working in
  this repo (security, testing, version control, TODOs).
- [`docs/GUIDE.md`](./docs/GUIDE.md) — spec of the PokéAPI inclusion/exclusion rules
  used by the generator.
- [`TODO.md`](./TODO.md) — known pending tasks.

## License

MIT — see [`LICENSE`](./LICENSE).
