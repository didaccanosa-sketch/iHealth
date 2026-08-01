# Project Map

Read this file first, before scanning the repo. It tells you what exists and
where, so you only open the files you actually need to touch. Do not glob/grep
the whole tree "just in case" — come back here instead.

## Top level

| Path | What it is |
|---|---|
| `app/` | Expo Router screens. Routing + layout only, no business logic. |
| `components/` | Shared UI components. Render engine output, never compute it. |
| `constants/theme.ts` | Design tokens (colors, spacing, etc.) — source of truth for styling. |
| `lib/engine/` | Pure business logic (calculations, recommendations). No UI, no direct Supabase calls. |
| `lib/data/` | Supabase reads/writes, one file per domain. |
| `lib/auth-context.tsx`, `lib/theme-context.tsx`, `lib/supabase.ts` | App-wide context/config. |
| `supabase/` | `schema.sql` (DB schema, idempotent — safe to re-run) + `functions/` (edge functions, e.g. AI meal analysis). |
| `features/` | Empty. Reserved for new modular development only — see PRODUCT_CONSTITUTION.md. Do not put anything here unless building a new feature module. |
| `docs/` | This map + architecture/product docs. Read the specific doc you need, not all of them. |
| `TODO.md` | Live, detailed day-to-day task/decision log (Spanish). Source of truth for "what's in progress right now." |
| `README.md` | Human setup instructions (install, Supabase, env vars). |
| `AGENTS.md` | Agent instructions (Expo defaults + this project's rules). `CLAUDE.md` imports it. |

## app/

- `_layout.tsx` — root layout.
- `(tabs)/_layout.tsx` — tab navigation.
- `(tabs)/index.tsx` — Today tab (placeholder, aggregates other modules — build last).
- `(tabs)/nutrition.tsx` — Nutrition tab (built: meals, macros, AI chat entry, templates).
- `(tabs)/training.tsx` — Training tab (built: mesocycles, sessions, cardio).
- `(tabs)/progress.tsx` — Progress tab (placeholder).

## components/

- `AuthScreen.tsx`, `Card.tsx`, `FadeIn.tsx`, `MacroBar.tsx`, `Screen.tsx` — shared primitives.
- `training/` — training-specific screens/widgets: `CardioScreen`, `CreateMesoChooser`, `DraftPreview`, `MesoMenu`, `MesoWizard`, `ProgramScreen`, `SessionView`, `TemplatePicker`.

## lib/engine/ (pure logic — this is where "the engine" lives today)

- `workout-engine.ts`, `cardio-engine.ts` — training calculations/progression.
- `nutrition-engine.ts` — macro/calorie calculations.
- `nutritionInsight.ts` — Nutrition Insight Engine (facts for the AI-redacted coach line).
- `goal-engine.ts` — Goal Engine (trend/verdict from a metric history + target).
- `recovery-engine.ts` — Recovery Engine (readiness from session feedback).
- `recommendation-engine.ts` — Recommendation Engine's Strategy Planner +
  Validation (`computeStrategyPlan`, `validateStrategyPlan`). Orchestrator
  core — see `docs/RECOMMENDATION_ENGINE.md` for the full design and
  `TODO.md` ("Orden de construcción") for build status.
- `meso-templates.ts`, `exercise-db.ts` — static data/templates.
- `types.ts` — shared engine types.

Note: these engines are still independent per-module — the Recommendation
Engine reads them, they don't read each other. See SYSTEM_ARCHITECTURE.md and
docs/RECOMMENDATION_ENGINE.md for how the orchestration layer is meant to work.

## lib/data/

`cardio.ts`, `nutrition.ts`, `profile.ts`, `workout.ts`, `weight-logs.ts`,
`strength-history.ts` — Supabase CRUD per domain.

## features/ (new modular development — see PRODUCT_CONSTITUTION.md)

`goal/ nutrition/ workout/ recommendation/ profile/ social/` — one folder per
future engine/module, built only as each piece actually gets built (not
scaffolded ahead of time). `profile/` is the only one with real content so
far: the User Model Engine (`engine/`, `data/`, `QuestionCard.tsx`) — see
`docs/USER_MODEL.md`. The rest are still empty; don't add to them
speculatively.
