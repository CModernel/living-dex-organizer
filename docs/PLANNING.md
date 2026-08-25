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
