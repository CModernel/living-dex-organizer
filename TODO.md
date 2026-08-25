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

- [ ] **3. Implement the actual app.** Today the whole repo is a data pipeline (scripts +
      generated JSON); there's no UI or business logic (marking Pokémon owned/not
      owned, see `docs/PLANNING.md`). There isn't even a `package.json`.
- [ ] **4. Backend/Supabase** for multi-device sync — future phase, **do not implement
      yet** (see `docs/PLANNING.md` and `docs/RULES.md` section 3). When tackled, it
      must leave the security TODOs `docs/RULES.md` section 1 requires.

## Distribution / CDN

- [x] **5. Move the dataset under `data/v1/`** to prepare for path-based versioning,
      mirroring the sibling `pokemon-trainer-data` project's jsDelivr CDN pattern —
      cheap now, avoids a breaking rename later once an app depends on a specific
      path. Done: `data/living-form-full-data.json` and
      `data/living-form-full-mapping-report.json` moved to `data/v1/`.
- [x] **6. Document jsDelivr CDN access in the README.** Done, now that the repo is
      pushed public — see the README's "Distribution" section.
- [ ] **7. Consider an incremental PokeAPI fetch cache** for
      `scripts/generate-living-form-full.js`, mirroring `pokemon-trainer-data`'s
      approach (reuse the previously committed output as the cache, only fetch IDs
      missing from it). Caution: our curation rules (`isExcludedForm`, tier
      predicates, dex corrections) change far more often than "a new National Dex ID
      appeared" — a naive skip-if-cached approach risks not reapplying an updated
      rule to already-cached entries. Would need a cache-invalidation story (e.g.
      bump a rules version alongside `CANDIDATE_CACHE_VERSION`) before this is safe.

## Infrastructure

- [x] **8. Wire `scripts/verify.js` into CI.** Done: `.github/workflows/ci.yml` runs
      `npm test` + `npm run verify` on every push/PR to `main`. Doesn't hit PokeAPI —
      validates the already-committed dataset and CSVs, so it's fast and free.
