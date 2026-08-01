# System Architecture

## Target architecture (future — not built yet)

```
Goal Engine
    ↓
User Model
    ↓
Recommendation Engine  (orchestrates everything below)
    ↓
Workout Engine · Nutrition Engine · Recovery Engine · Insights
```

The Recommendation Engine is the single orchestrator. It reads the User
Model (which is shaped by the Goal Engine) and coordinates the domain
engines — it's the only thing allowed to call more than one domain engine
at once. Domain engines stay independent of each other.

This gets built incrementally inside `features/` (see PROJECT_MAP.md and
PRODUCT_CONSTITUTION.md) — not as a rewrite of what exists today.

## Current actual architecture (what's really running)

There is no Goal Engine, User Model, or Recommendation Engine yet. Today
each module is self-contained:

- `lib/engine/nutrition-engine.ts` — macro/calorie math, called directly by
  the nutrition screens.
- `lib/engine/workout-engine.ts` + `cardio-engine.ts` — mesocycle/session
  logic, called directly by the training screens.
- `lib/data/*.ts` — Supabase reads/writes per domain, called by
  screens/engines as needed.
- Per `TODO.md`: there's deliberately **no single rigid goal** yet — each
  module (Nutrition, Training) keeps its own simple goal, settable by hand
  or via a one-off AI suggestion for that module. "Today" presents them
  together visually, but underneath they're independent. The unified
  Recommendation Engine described above is future/paid-tier work, noted but
  not being built now.

When the Goal Engine / User Model / Recommendation Engine layer does get
built, it wraps the existing per-module engines rather than replacing them —
check `lib/engine/` for logic that already exists before writing new logic
in `features/`.
