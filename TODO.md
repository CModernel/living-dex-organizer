# TODO

Known pending tasks. No external system (Trello, etc.) — kept here by hand. Format:
what's missing + why it was left pending. Every item is numbered (assigned once,
kept stable — order doesn't reflect priority or add date) so it can be referenced
in conversation ("do #2 next"); number new items when they're added, don't renumber
existing ones.

## Data

- [x] **1. Derive sprite URLs instead of storing them in full.** Done via
      `scripts/lib/sprite-url.js`: each entry now stores a derived
      `{ id, hasFemale, hasShinyFemale }` plus one shared top-level
      `sprite: { baseUrl, variants }`, instead of 4 full URLs. Cut the dataset from
      1.15MB to 830KB (~28%). Along the way, found and fixed a real bug this work
      depended on: multi-form cosmetic species (Unown, Vivillon, Alcremie, Furfrou,
      Flabébé/Floette/Florges) were all sharing their parent's sprite instead of
      each form's own — see the "Fix shared sprites" commit.

- [x] **2. Add the per-game regional Pokédex numbers.** Done: each entry now has a
      sparse `regionalDex` map (e.g. `{ "galar": 1, "blueberry": 227 }`) built from
      `pokemon-species.pokedex_numbers`, extracted in `scripts/lib/generate-rules.js`'s
      `extractRegionalDex` (no extra requests — the species fetch already used for
      `generation`/`dex` carries this field too). Uses PokeAPI's own regional dex
      names (`galar`, `isle-of-armor`, `crown-tundra`, `extended-sinnoh`, `hisui`,
      `paldea`, `kitakami`, `blueberry`, `lumiose-city`) rather than replicating the
      original sheet's SwSh/BDSP/PLA/SV/PLZA letter-prefix grouping. 1311/1387
      entries have at least one regional dex entry.

## Product / App

- [ ] **3. Implement the actual app.** Today this repo is only a data pipeline
      (scripts + generated JSON); there's no UI or business logic (marking Pokémon
      owned/not owned, see `docs/PLANNING.md`). Decided: the app lives in its own
      separate repo (mirroring the sibling `Pokemon Champions` project's
      data-repo/app-repo split), consuming `data/v1/living-form-full-data.json` via
      the jsDelivr CDN documented in the README — not built inside this repo.
- [ ] **4. Backend/Supabase** for multi-device sync — future phase, **do not implement
      yet** (see `docs/PLANNING.md` and `docs/RULES.md` section 3). When tackled, it
      must leave the security TODOs `docs/RULES.md` section 1 requires.
- [ ] **27. Design the multi-list user-state data model** before starting frontend
      work. `docs/PLANNING.md`'s current `getUserState()`/`setUserState()` sketch
      assumes one list; #16 needs several simultaneous named lists (e.g. a shiny
      Living Dex and a regular one), each with its own tier/filter definition and
      owned/not-owned map. Needs a shape like a map of list-id → { name, baseTier,
      ownedState } before components get built against it.

## Web App (requirements for #3)

Feature/UX requirements gathered for the app before it's built. All still open.

- [ ] **10. Dark mode.**
- [ ] **11. Customizable columns** — the user chooses which columns are visible.
- [ ] **12. Mobile/tablet-friendly layout**, including a "compact" display mode —
      needs to be comfortable to use on a phone, not just technically responsive.
- [ ] **13. Intro/welcome page.** Decide whether mobile gets a shorter version of
      the message than desktop.
- [ ] **14. Customizable filtering beyond the 5 base tiers** — evolution stage
      (pre-evos), regional form diffs, other form diffs, gender diffs, and shiny.
      Decide whether shiny variants are shown freely or gated behind a lock/unlock.
- [ ] **15. Export/import** user data (list definitions + owned/not-owned state).
- [ ] **16. Support multiple lists per user** (e.g. a shiny Living Dex and a regular
      one at the same time). Empty state shows a "start a list" button that asks for
      a name and, optionally, which Living Dex type to base it on.
- [ ] **17. Box/slot column hidden by default.** Only surfaced on request, and only
      suggested for the more basic tiers (Base Dex, Final Form, etc.) by asking if
      the user plans to eventually organize/migrate physically.
- [ ] **18. Start with a minimal, simple interface**; let the user progressively
      customize columns to their liking (pairs with #11).
- [ ] **19. Persist user preferences** (visible columns, compact mode, etc.) in the
      browser session first, and later in the user's account once login exists
      (see #4).
- [ ] **20. Main view: an Excel/spreadsheet-style table** of Pokémon where the user
      marks which ones they own.
- [ ] **21. Some kind of progress indicator/chart** (e.g. % complete).
- [ ] **22. Sticky column headers on scroll**, so the user always knows which
      column is which.
- [ ] **23. Mobile layout must work well in portrait; also test landscape.**
- [ ] **24. Unit tests for any new app code** — already a standing rule
      (`docs/RULES.md` #5), reiterated here specifically for the app.
- [ ] **25. Consider integration tests** for the app.
- [ ] **26. Consider UI tests** for the app.

## Distribution / CDN

- [x] **5. Move the dataset under `data/v1/`** to prepare for path-based versioning,
      mirroring the sibling `pokemon-trainer-data` project's jsDelivr CDN pattern —
      cheap now, avoids a breaking rename later once an app depends on a specific
      path. Done: `data/living-form-full-data.json` and
      `data/living-form-full-mapping-report.json` moved to `data/v1/`.
- [x] **6. Document jsDelivr CDN access in the README.** Done, now that the repo is
      pushed public — see the README's "Distribution" section.
- [x] **7. Consider an incremental PokeAPI fetch cache** — decided against, not
      implemented. On closer look, our curation rules (`isExcludedForm`, tier
      predicates, dex corrections) are already applied fresh at read time against
      the cached raw candidates, not baked into the cache — so a rules change
      already works fine with the existing versioned cache, no incremental fetch
      needed for that case. The actual risk incremental fetching would introduce:
      PokeAPI adds data to species that already exist (e.g. Legends Z-A added a
      `lumiose-city` entry to Bulbasaur's `pokedex_numbers`, an already-cached
      species, not a new one) — a naive "skip if already cached" approach would
      miss exactly that. See #9 for what we did instead.

## Infrastructure

- [x] **8. Wire `scripts/verify.js` into CI.** Done: `.github/workflows/ci.yml` runs
      `npm test` + `npm run verify` on every push/PR to `main`. Doesn't hit PokeAPI —
      validates the already-committed dataset and CSVs, so it's fast and free.
- [x] **9. Weekly automated PokeAPI regeneration.** Done:
      `.github/workflows/weekly-regenerate.yml` runs every Monday (plus manual
      trigger) — full fetch, not incremental (see #7), runs `npm test` +
      `npm run generate` + `npm run verify`. If verify fails, the workflow just
      fails (visible in the Actions tab) and nothing lands. If it passes and the
      dataset changed, it opens a PR (via `peter-evans/create-pull-request`) instead
      of pushing to `main` directly — keeps a human reviewing the diff/report before
      merging, same spirit as `docs/RULES.md` #7 (never commit without confirmation)
      even for automation.
