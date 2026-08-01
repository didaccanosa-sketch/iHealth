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
- `meso-templates.ts`, `exercise-db.ts` — static data/templates.
- `types.ts` — shared engine types.

Note: today these engines are independent per-module (no unified Goal Engine /
User Model / Recommendation Engine yet — that's the future architecture, see
SYSTEM_ARCHITECTURE.md). Don't assume orchestration exists until it's built.

## lib/data/

`cardio.ts`, `nutrition.ts`, `profile.ts`, `workout.ts` — Supabase CRUD per domain.

## features/ (empty — future only)

`goal/ nutrition/ workout/ recommendation/ profile/ social/` — one folder per
future engine/module. Nothing lives here yet. See PRODUCT_CONSTITUTION.md
before adding anything.
