# Product Constitution

Fixed rules for how this codebase grows. These don't change per-feature —
if a change would violate one of these, stop and ask instead of proceeding.

## Structure

- Keep the current Expo Router structure (`app/`, `components/`, `lib/`, etc.).
  Do not create a `src/` folder.
- Do not move existing files as part of unrelated work.
- `features/` is for **new** development only. Existing code stays where it is.
- Existing code stays untouched unless a task specifically requires changing it.
  "While I'm in here" refactors are not allowed.
- Refactoring happens incrementally, after V1, one piece at a time — never as
  a big-bang migration.

## Business logic vs UI

- Business logic lives in engines (`lib/engine/` today; `features/*/engine`
  going forward). UI never decides anything — it only renders what an engine
  already computed.
- If a component is doing math, branching on domain rules, or calling
  Supabase directly to derive a decision, that logic belongs in an engine,
  not the component.

## New feature modules

- New features are gradually built inside `features/<name>/`, not bolted
  onto `app/`, `components/`, or `lib/` directly.
- A feature module should keep its own engine (logic) separate from its own
  UI, mirroring the project-wide rule above.

## Goal

Build a modular, AI-first wellness platform that stays easy for an AI agent
to maintain: minimal context needed per session, low risk of unintended
side effects, changes stay scoped to what was asked.
