# TODO

Known pending tasks. No external system (Trello, etc.) — kept here by hand. Format:
what's missing + why it was left pending.

## Data

- [ ] **Derive sprite URLs instead of storing them in full.** Today
      `data/living-form-full-data.json` stores 4 full sprite URLs per entry (all
      sharing the same `https://raw.githubusercontent.com/PokeAPI/...` prefix repeated
      hundreds of times). Replace with a `baseUrl` + filename pattern (same principle
      the now-removed `SPRITE-JSON-STRUCTURE-SPECS.md` had), applied to the PokeAPI
      dataset. Requires touching `scripts/generate-living-form-full.js` and probably
      re-running it.

- [ ] **Add the per-game regional Pokédex numbers** (SwSh/BDSP/PLA/SV/PLZA columns in
      the original sheet — each game's own regional Pokédex position, e.g. Grookey is
      "#1" in Galar's own dex, not its National number 810). These ARE available from
      PokeAPI, confirmed live: `GET /pokemon-species/{name}/` → `pokedex_numbers`
      (NOT `pokemon.game_indices`, which is a dead end — it just mirrors the National
      number for every Gen 4+ game). Confirmed mapping from the sheet's columns to
      PokeAPI's `pokedex.name` values:
      | sheet column | no letter prefix | lettered prefix |
      |---|---|---|
      | SwSh  | `galar` | A = `isle-of-armor`, C = `crown-tundra` |
      | BDSP  | `original-sinnoh` (same values as `extended-sinnoh` in every case checked) | — |
      | PLA   | `hisui` | — |
      | SV    | `paldea` | B = `blueberry` (kitakami's prefix letter not yet confirmed) |
      | PLZA  | `lumiose-city` | — |
      Verified against Grookey, Piplup, Bulbasaur, Charmander, Zubat, and Jigglypuff —
      every value matched the sheet exactly. Since this no longer depends on the CSV,
      it can be added to `scripts/generate-living-form-full.js` (fetch
      `pokemon-species.pokedex_numbers` per entry, store the relevant regional entries)
      whenever the per-game filtering feature is actually wanted.

## Product / App

- [ ] **Implement the actual app.** Today the whole repo is a data pipeline (scripts +
      generated JSON); there's no UI or business logic (marking Pokémon owned/not
      owned, see `docs/PLANNING.md`). There isn't even a `package.json`.
- [ ] **Backend/Supabase** for multi-device sync — future phase, **do not implement
      yet** (see `docs/PLANNING.md` and `docs/RULES.md` section 3). When tackled, it
      must leave the security TODOs `docs/RULES.md` section 1 requires.

## Distribution / CDN

- [x] **Move the dataset under `data/v1/`** to prepare for path-based versioning,
      mirroring the sibling `pokemon-trainer-data` project's jsDelivr CDN pattern —
      cheap now, avoids a breaking rename later once an app depends on a specific
      path. Done: `data/living-form-full-data.json` and
      `data/living-form-full-mapping-report.json` moved to `data/v1/`.
- [ ] **Document jsDelivr CDN access in the README** once this repo is pushed public.
      A public GitHub repo is automatically servable via
      `https://cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/<path>`, with free global
      caching and automatic gzip/brotli — measured: our 1.15MB JSON is ~60KB over
      gzip. No hosting needed; this just needs writing down so a future app fetches
      it this way instead of bundling the JSON into the app binary.
- [ ] **Consider an incremental PokeAPI fetch cache** for
      `scripts/generate-living-form-full.js`, mirroring `pokemon-trainer-data`'s
      approach (reuse the previously committed output as the cache, only fetch IDs
      missing from it). Caution: our curation rules (`isExcludedForm`, tier
      predicates, dex corrections) change far more often than "a new National Dex ID
      appeared" — a naive skip-if-cached approach risks not reapplying an updated
      rule to already-cached entries. Would need a cache-invalidation story (e.g.
      bump a rules version alongside `CANDIDATE_CACHE_VERSION`) before this is safe.

## Infrastructure

- [ ] **Wire `scripts/verify.js` into CI** once a `package.json` / GitHub Actions
      exists, so it runs automatically on every change to the CSVs or the generator,
      instead of having to remember to run it by hand.
