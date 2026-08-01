# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project rules (iHealth)

## Start here, every session

Read `docs/PROJECT_MAP.md` first. It tells you what exists and where. Only
open the specific files a task requires — don't scan or read the whole repo
"to be safe." This project is optimized for low-context, low-error sessions,
not exhaustive re-reading.

## Which docs to read — routing table

Default is **zero extra docs**. `docs/PROJECT_MAP.md` is enough for most
tasks (simple fixes, edits to an existing screen/component/engine file you
were pointed at). Only open one of the docs below if the task actually
matches its trigger — never open all of them "just in case," and never open
one you already read earlier in this same session.

| Task matches... | Read (only this) |
|---|---|
| Bug fix / small change in a file you already know | Nothing extra. Just the file(s) you're editing. |
| Adding logic to an existing `lib/engine/*` file | `docs/SYSTEM_ARCHITECTURE.md` (current-state section) |
| Anything inside `features/*` (new module work) | `docs/PRODUCT_CONSTITUTION.md` + `docs/SYSTEM_ARCHITECTURE.md` |
| Colors, spacing, shared UI primitives | `docs/DESIGN_SYSTEM.md` |
| Goals, profile, user state/preferences | `docs/USER_MODEL.md` |
| "What should I work on / what's next" | `docs/ROADMAP.md` and/or `TODO.md` |
| "What changed recently that I should know about" | `docs/CHANGELOG_FOR_AI.md` |
| Unsure which existing file does X | Check `docs/PROJECT_MAP.md` first — don't Grep/Glob the whole repo before checking there. |

If a task doesn't match any row, don't read a doc speculatively — ask or
proceed with what's in `docs/PROJECT_MAP.md`.

## Hard rules

- Do not create a `src/` folder. Keep the current `app/`, `components/`,
  `lib/` structure.
- Do not move or restructure existing files unless the task explicitly asks
  for it.
- `features/` is for new development only (`goal/`, `nutrition/`, `workout/`,
  `recommendation/`, `profile/`, `social/`). Don't add to it speculatively;
  don't move existing code into it as a side effect of another task.
- Business logic goes in an engine (`lib/engine/` today, `features/*/engine`
  for new modules). Components/screens only render engine output — no domain
  decisions inside JSX or component logic.
- Prefer the smallest possible diff. Don't refactor adjacent code you weren't
  asked to touch, even if it looks improvable.
- Full architecture and rationale: `docs/PRODUCT_CONSTITUTION.md`.

## After making a change

If the change touched architecture, added/changed an engine, or changed a
data shape other modules depend on, add one line to
`docs/CHANGELOG_FOR_AI.md` (format is in that file). Skip this for routine
fixes already covered by `TODO.md`.
