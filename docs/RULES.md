# Development Rules — Poke Organizer

> This file defines mandatory rules for **any AI model/assistant** (Claude, or any
> other) working in this repository. It is not end-user documentation.
>
> See also [`PLANNING.md`](./PLANNING.md) for the data architecture and roadmap details.

## 1. Security and sensitive data

- **Never** hardcode credentials, API keys, passwords, OAuth secrets, tokens, or any
  other sensitive information.
- **Never** expose privileged credentials in frontend code.
- Any implementation touching one of these areas:
  - credentials
  - authentication/login
  - OAuth
  - sensitive user data
  - authorization/security rules
  - user data persistence
  - backend access
  - database access
  - secrets/environment variables
  - Supabase

  **must** leave an explicit TODO describing what still needs to be reviewed/implemented
  securely by a more advanced model (see the TODO section).
- Do not assume security-sensitive architecture decisions without documenting them
  explicitly.
- Do not silently implement a security-sensitive temporary solution assuming it "will be
  replaced later." If you do, it must leave a TODO.

## 2. Static data vs. user state

- Static Pokémon/Dex data (definitions, list structure) is **application data**, not
  user data.
- User state (which Pokémon is marked owned/not owned, etc.) must be kept **separate**
  from the static definitions.
- The user can only modify their own collection state; **never** the static Pokémon/Dex
  definitions.
- Avoid duplicating/redundant data between the static dataset and user state.

## 3. Backend and storage

- Supabase is planned for the future, but **must not be implemented** unless explicitly
  requested.
- The user data sync/storage architecture will be implemented later by a more advanced
  model.
- Keep the current architecture modular so Supabase (or another backend) can be
  introduced without major refactors.
- Do not hardcode assumptions that couple the app to a specific backend/storage
  provider.
- Do not introduce services, servers, databases, or unnecessary dependencies before they
  are actually needed.

## 4. General architecture

- Prefer simple solutions; avoid premature backend infrastructure.
- Keep business logic independent from the UI whenever practical.
- Prefer interfaces/abstractions where they ease a future storage sync migration.
- The data model must allow adding new Dex/list types without rewriting core logic.

## 5. Testing

- Every new implementation must include unit tests.
- Unit tests must cover all relevant business logic, including edge cases.
- When appropriate, also evaluate:
  - Integration tests
  - UI tests
  - End-to-end tests
- A feature is not considered complete if its core business logic isn't tested.

## 6. TODO policy

- TODOs are mandatory for security decisions or future architecture decisions that are
  intentionally left pending (see section 1).
- Each TODO must clearly explain **what's missing** and **why** it was left pending.
- TODOs can be moved later to an external task system (e.g. Trello) if that turns out to
  be more convenient.
- Every item in `TODO.md` is numbered (assigned once when added, never renumbered) so
  it can be referenced in conversation. New items get the next number; order in the
  file doesn't need to match numeric or chronological order.
- Suggested format in code:
  ```
  // TODO(security): <what needs review/implementation> — <why it was left pending>
  ```

## 7. Version control (git)

- **Never** run `git commit` or `git push` (or destructive operations like
  `git reset --hard`, `git push --force`, etc.) without the user's explicit confirmation
  at that specific moment.
- The user decides when to commit and when to push; the assistant can leave changes in
  the working tree or staged (`git add`), but must not commit on its own.
- A past authorization does not extend to future actions: every commit/push requires its
  own explicit confirmation.

## 8. Language

- All project content — documentation, code, comments, commit messages, file and
  variable names — must be written in **English**, regardless of the language the
  conversation happens in.
- This applies to every file in the repo, not just new ones: when a file is touched, it
  should end up in English.

## 9. General rule

When in doubt, always prefer a simple, testable, modular implementation that keeps the
door open for a future backend/storage migration, without implementing it prematurely.
