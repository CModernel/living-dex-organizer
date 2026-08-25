# Architecture Planning — Poke Organizer

> Implementation detail and roadmap. Mandatory rules (security, testing, TODOs) live in
> [`RULES.md`](./RULES.md); this file focuses on **how** data is structured and **what**
> is left for later.

## Static Pokémon/Dex dataset

- Maintain a static JSON dataset describing the structure/content of each supported list
  type, for example:
  - Base Dex
  - Living Dex
  - Shiny Dex
  - Forms Dex
  - Game-specific dexes
  - Other collection types
- This dataset must live inside the repository (probably on GitHub, versioned alongside
  the code).
- It's application data, not user data — it must not be mixed with the state the user
  modifies.
- The data model must allow adding new Dex/list types without redesigning the core logic
  (think of a generic/parameterizable schema instead of one hardcoded per dex type).

## User state

- Main interaction:
  - The user marks a Pokémon → owned/selected.
  - The user unmarks a Pokémon → not owned/not selected.
- User state is stored separately from the static dataset (e.g. a map of IDs → state,
  not a copy of the dataset with an added field).
- Avoid redundancy: don't duplicate information already present in the static dataset.

### Multi-list data model (TODO #27)

The app supports several simultaneous named lists (e.g. a shiny Living Dex and a
regular one, TODO #16), not just one collection:

```ts
type UserState = {
  lists: Record<string /* list id */, PokemonList>;
  activeListId: string | null;   // last-viewed list, for resuming on reload
  preferences: {
    visibleColumns: string[];    // TODO #11
    compactMode: boolean;        // TODO #12
    darkMode?: 'system' | 'light' | 'dark'; // TODO #10
  };
};

type PokemonList = {
  id: string;                    // stable unique id
  name: string;                  // user-given display name
  createdAt: string;             // ISO timestamp
  dataVersion: 'v1';             // which data/v{N} schema this filter assumes
  variant: 'normal' | 'shiny';   // same entries, different sprite + tracked meaning
  filter: ListFilter;
  ownedIds: string[];            // sparse: owned entry slugs; absence = not owned
};

// Three independent toggles, all off by default (= living-form-full, the
// unfiltered master — the least restrictive starting point, per the user's own
// framing: start from the full list, then add/remove filters). Turning one on
// only ever narrows the set; there's no independent "build a filter from
// scratch" mode — a generic query builder could drift from the curated rules
// below, so it's deliberately not offered.
type ListFilter = {
  finalStageOnly: boolean;      // default false = all evolution stages
  regionalFormsOnly: boolean;   // default false = all alternate forms
  hideGenderVariants: boolean;  // default false = include them
};
```

These 3 toggles fully cover the 8 possible combinations, of which 5 are
Austin John's own curated tiers — confirmed against the real dataset:

| finalStageOnly | regionalFormsOnly | hideGenderVariants | tier | count |
|---|---|---|---|---|
| false | false | false | Living Form Full (master) | 1387 |
| false | false | true  | Living Form | 1284 |
| false | true  | true  | Living Lite | 1082 |
| true  | false | true  | Final Form Full | 716 |
| true  | true  | true  | Final Form | 604 |

**Exceptions are per-combination, not per-toggle — this is the reason for the
resolution rule below.** Each curated tier layers species-specific exceptions on
top of the generic rule (e.g. Living Lite force-keeps `basculin-2` and drops
`tauros-2/-3`; Final Form Full instead collapses Minior's colors, Magearna's
Original Pokéball recolor, and non-Vanilla Alcremie flavors). Proof these aren't
derivable from a toggle in isolation: `regionalFormsOnly` appears in both Living
Lite and Final Form, but Floette Eternal Flower is handled *oppositely* in each
(deliberately, confirmed with the user 2026-08-24) — so no rule of the form "if
`regionalFormsOnly` then apply X" can be correct in general. The exceptions are
irreducibly editorial, tied to `scripts/lib/tiers.js` / `packages/tiers`'s exact
predicates, not to the generic toggles.

**The remaining 3 combinations (`hideGenderVariants: false` crossed with either
restriction) have no curated tier** — Austin John's sheets never defined them.
Default for those: inherit the species-exceptions from the curated tier that
shares the same `(finalStageOnly, regionalFormsOnly)` pair, ignoring
`hideGenderVariants` for that lookup only (none of the exceptions reference
gender-variant status, so this is a safe, well-justified reuse — not a guess):

| finalStageOnly | regionalFormsOnly | inherits exceptions from |
|---|---|---|
| false | true  | Living Lite |
| true  | false | Final Form Full |
| true  | true  | Final Form |

This is a pragmatic default, not a curated answer — flag it as such wherever the
app surfaces one of these 3 combinations (e.g. "this exact combination wasn't
part of Austin John's sheets; minor cosmetic-variant collapsing is approximated").

Notes:
- Box/slot position (TODO #17) is **never persisted** — always derived client-side
  from a list's filtered, `sortIndex`-sorted entries, chunked into boxes of 30, per
  `generate-living-form-full.js`'s own stated design.
- The empty-state "start a list" flow (TODO #16) just creates a new `PokemonList`
  with `ownedIds: []` and the 3 toggles at their defaults (or pre-set to a known
  combination, e.g. a "Final Form" quick-start button).
- Storage still goes through `getUserState()`/`setUserState()` (whole-object
  read/write, see below); any finer-grained helpers (`toggleOwned`, `upsertList`)
  are a thin layer on top in the app, not a new persistence primitive.

## Storage/backend roadmap

- **Current phase**: no backend. User state in local storage (e.g.
  localStorage/in-memory state), static dataset embedded in the repo.
- **Future phase (do not implement yet)**: Supabase or another backend for syncing user
  data across devices.
  - User authentication/login.
  - Remote persistence of user state.
  - Possible multi-device sync.
- To avoid blocking that future migration:
  - Encapsulate access to user state behind an interface/abstraction (e.g. a
    "repository" or "store" with `getUserState()`/`setUserState()` methods), so the
    concrete implementation (localStorage → Supabase) can be swapped without touching
    business logic or the UI.
  - Don't couple UI components directly to a concrete storage mechanism.

## Notes

- This file is internal planning and can evolve without needing to update `RULES.md`,
  unless a mandatory rule changes.
- When the backend/Supabase phase is tackled, that work must follow the "Security and
  sensitive data" section of `RULES.md` (explicit TODOs, no hardcoded secrets, etc.).
- Not planned work, just a thought worth keeping in mind: if sustaining this project
  long-term ever becomes relevant, prefer a low-friction, non-intrusive option (e.g. a
  GitHub Sponsors / donation link) over ads or paywalls.
