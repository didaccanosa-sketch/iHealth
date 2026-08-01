# Changelog for AI

Purpose: let the next session know what changed recently without re-reading
diffs or re-scanning the codebase. Newest entry at the top.

After any change that touches architecture, adds/changes an engine, or
alters a rule from PRODUCT_CONSTITUTION.md, add one entry here — one line,
past tense, no explanation of *how*, just *what* and *where*.

Do not log routine bug fixes already tracked in `TODO.md` — only log things
a future session needs to know before touching related code (new module
under `features/`, new engine, changed data shape, changed rule).

Format:

```
## YYYY-MM-DD
- Short, factual line. Files/folders touched in backticks.
```

---

## 2026-08-02 (regla general: preguntas del chat de una en una, botones para opciones cerradas)
- Nueva regla general para todo lo que el chat pregunta (no solo un caso
  puntual): nunca se combinan dos preguntas en un mismo mensaje, y si la
  respuesta es de una lista cerrada se pide con botones, no texto libre.
- `lib/data/chat-options.ts` (nuevo): registro de qué campos tienen
  opciones cerradas (`daysPerWeek`, `equipment`, `mealsPerDay`) con sus
  opciones — cualquier campo nuevo de opción cerrada se añade aquí.
- Contrato de `chat-assistant` (`supabase/functions/chat-assistant/index.ts`)
  cambia: nuevo campo `askField` en la respuesta JSON (qué dato concreto se
  está preguntando, o `null`). La pregunta combinada de la rutina
  (días/equipo/gustos) se reemplaza por preguntas sueltas, una por turno,
  en el orden de `missingTrainingPrefs` (ahora incluye `daysPerWeek`).
  **Pendiente: redeploy de `chat-assistant`.**
- `lib/data/chat.ts`: `ChatContext` gana `missingMealsPerDay`; `ChatResult`
  gana `askField`. `propose_diet` ahora también pregunta `mealsPerDay`
  antes de generar si no se sabe (mismo patrón que la rutina).
- `app/(tabs)/index.tsx`: los mensajes del chat pueden traer `askField`; si
  es uno de `chat-options.ts` se muestran botones (mismo estilo que
  `helpAreaOptions` en `app/onboarding.tsx`) en vez de dejar escribir.

## 2026-08-02 (memoria del chat, lesiones, rutina con preferencias, onboarding en dos pasos)
- Ver `docs/SIMPLIFIED_VISION.md` → "Estado actual (2026-08-02)" y
  "Próxima entrega planificada" para el resumen completo y la idea
  acordada (no empezada) para la siguiente sesión — no repetir aquí.
- `sendChatMessage` (`lib/data/chat.ts`) y `chat-assistant`
  (`supabase/functions/chat-assistant/index.ts`) ahora mandan/reciben
  historial de conversación (últimos ~8 turnos) — antes cada mensaje se
  procesaba suelto, sin memoria de lo que el propio chat acababa de
  preguntar. **Pendiente: redeploy de `chat-assistant`.**
- `TrainingModel.injuries` (ya existía en el esquema, sin usar) ahora se
  rellena solo desde el chat y bloquea `propose_workout` mientras esté
  confirmado — no se genera rutina automática con una lesión en el perfil.
- `lib/engine/exercise-db.ts`: `EXERCISE_DB` cambió de `string[]` a
  `{name, equipment}[]` por grupo — cualquier código que lo lea como lista
  de strings hay que actualizarlo (`ExerciseEquipment`, `EquipmentLevel`,
  `EQUIPMENT_ELIGIBLE` nuevos). `buildFocusSplit`
  (`lib/engine/meso-templates.ts`) acepta un tercer argumento opcional
  `ExercisePreferences` (equipo/preferidos/no-preferidos) y filtra/prioriza
  con él.
- `propose_workout` por chat ya no genera sin preguntar ni con un simple
  sí/no: la primera vez en la conversación pregunta días/enfoque/equipo/
  gustos en una sola pregunta combinada (usando `context.missingTrainingPrefs`,
  calculado en código, nunca decidido por la IA), y no la repite si ya la
  hizo (usa el historial para saberlo).
- `features/profile/engine/types.ts`: `IdentityModel` ahora se rellena con
  nombre/apellidos también desde el chat (`saveIdentity`, antes
  `setIdentityFromChat`, ahora exportada). Nuevo campo
  `preferences.helpAreas: Field<HelpArea[]>` (opción cerrada: training /
  nutrition / weight_tracking / all).
- `app/onboarding.tsx` reescrito en dos pasos: formulario nativo (nombre,
  edad, sexo, altura, peso — no pasa por la IA, `saveIdentity` directo) y
  luego chat solo para objetivo + la pregunta cerrada de `helpAreas` (con
  botones, no texto libre). No dejar pasar a la app hasta que las tres
  cosas estén confirmadas.

## 2026-08-01 (paso 7 — motor conectado a agua/sueño/pasos)
- `StrategyPlan.water.dailyMlTarget` now scales with body weight
  (~35ml/kg) instead of always being the fixed generic —
  `lib/engine/recommendation-engine.ts`. Sleep/steps targets stay generic
  (no personalization formula for those yet).
- `computeDailyFocus` gained optional inputs (`sleepHoursLastNight`,
  `waterMlToday`/`waterMlTarget`, `stepsToday`/`stepsTarget`) and a new
  `domain: 'wellness'` (never gets overridden by the nutrition insight
  line, unlike `'nutrition'`). Today screen now fetches
  `fetchTodayTracking` and feeds it in.

## 2026-08-01 (paso 6 — capa de IA: redacción, sin Goal Chat)
- `StrategyPlan.explanations` changed shape: was `string[]`, now
  `{ nutrition: string[]; training: string[] }` (same split applied to
  `ValidationResult.conflicts`) — `lib/engine/recommendation-engine.ts`.
  All explanation/conflict text rewritten in plain Spanish (dropped
  "TDEE", "Mifflin-St Jeor", "measured/generic" jargon). Any code reading
  `plan.explanations` as a flat array needs updating to `.nutrition` /
  `.training`.
- New `supabase/functions/recommendation-explain` (not deployed yet) +
  `explainRecommendation(domain, facts)` in `lib/data/recommendation.ts`:
  AI redaction of the plain-language facts into a natural, personalized
  paragraph, fetched on-demand (only when the info toggle opens) with no
  caching. Wired into both the Nutrition proposal card and the Workout
  wizard's review step.
- Goal Chat (free-text goal interpretation) was explicitly scoped **out**
  of this session — full spec written in `TODO.md` under "Goal Chat —
  diseño" for whichever session builds it next.

## 2026-08-01 (madrugada — Recommendation Engine, paso 4 completo: entrada Workout)
- `StrategyPlan.training` gained a `level` field (mapped from
  `Experience`, defaults to `'principiante'`) — computed in
  `lib/engine/recommendation-engine.ts`.
- `CreateMesoChooser` has a new "Recommend for me" option (separate from
  the still-unbuilt "Build it with AI chat"). Wired in
  `app/(tabs)/training.tsx`: calls `getStrategyRecommendation`, builds the
  day/exercise split with the existing `buildFocusSplit` generator (no
  muscle-group priority yet), and jumps straight into the wizard's review
  step (same pattern as picking a template) — nothing is created without
  confirmation. All 3 entry points from the design doc now have at least
  a first version except the combined Onboarding one.

## 2026-08-01 (noche — Recommendation Engine, paso 4 parcial: entrada Nutrition)
- New `lib/data/recommendation.ts`: `buildStrategyContext()` (assembles
  real Goal Engine evaluation + Recovery Engine readiness + User Model into
  `StrategyPlannerContext`) and `getStrategyRecommendation()` (context →
  `computeStrategyPlan` → `validateStrategyPlan`). This is the first real
  caller of the Recommendation Engine core built earlier today.
- Nutrition screen has a working "Recalcular con el motor" button — shows
  the proposed macro goal, only saves (`saveMacroGoal`, source
  `recommendation_engine`) if the user confirms. Workout entry point still
  not wired (needs the mesocycle wizard, separate step).

## 2026-08-01 (tarde — Recommendation Engine, pasos 1-3)
- Added `lib/engine/recommendation-engine.ts`: `computeStrategyPlan()`
  (Strategy Planner — deterministic targets for calories/macros, training
  frequency+phase, cardio/week, generic sleep/steps) and
  `validateStrategyPlan()` (safety/coherence checks, adjusts and explains).
  Full design in new `docs/RECOMMENDATION_ENGINE.md`.
- New `macro_goals` table (`supabase/schema.sql`, history by date) +
  `fetchCurrentMacroGoal`/`saveMacroGoal` in `lib/data/nutrition.ts`. Today
  and Nutrition screens now load the user's saved goal, falling back to
  `DEFAULT_GOALS` only if none exists yet.
- `weight_logs` now has a unique `(user_id, logged_at)` constraint — one
  weight entry per day, `logWeight` upserts instead of inserting.
  `GoalCard.tsx` reflects this (pre-fills today's value, edits in place).
- Implemented real logout (`app/profile.tsx`, was a "Coming soon" placeholder).

## 2026-08-01 (retroactivo — no logueado en su momento)
- **Goal Engine v1** and **Recovery Engine v1** were built earlier this same
  day (see `TODO.md` for full detail) but not logged here at the time:
  `lib/engine/goal-engine.ts` (trend/verdict engine, generic per
  `GoalConfidence`), `lib/engine/recovery-engine.ts` (readiness from session
  feedback), `lib/data/weight-logs.ts` + `lib/data/strength-history.ts`,
  `components/goal/*`. `goals`/`goal_predictions` tables dropped from
  `schema.sql` (superseded by `user_model.goals`).

## 2026-08-01
- Built the first version of the **User Model Engine** in `features/profile/`
  (`engine/types.ts`, `engine/user-model.ts`, `engine/questions.ts`,
  `data/user-model-data.ts`), plus new `user_model` table in
  `supabase/schema.sql`. Fields use only `unknown`/`confirmed` status — no
  confidence score yet (deliberately out of scope, see `docs/USER_MODEL.md`).
  Categories with real content: identity, goals, training, nutrition,
  lifestyle, adherence. Defined but empty: body, motivation, preferences,
  health (Health needs a dedicated decision before it gets fields, see doc).
  Adherence fields are meant to be filled by other engines later — no
  auto-fill hooks wired yet, that's a separate task.
- Added `app/profile.tsx` (new standalone route, not a tab) to edit Identity
  fields (age, sex, height, starting weight); reachable by tapping the
  avatar on Today. It dual-writes `profiles.height_cm` /
  `starting_weight_kg` / `preferred_training_days` so existing readers
  (`TemplatePicker`, Today) keep working untouched.
- Added `features/profile/QuestionCard.tsx`, embedded in
  `app/(tabs)/index.tsx` (Today) — shows one Question Engine question at a
  time (progressive profiling), no dedicated screen.
- Not built yet: Goal Chat (conversational onboarding), auto-fill from
  other engines into `user_model`, Recommendation Engine reading from it,
  and the rest of the Profile screen (email/password/logout/theme toggle).

## 2026-07-31
- Set up `docs/` as the project's map/rules layer and extended `AGENTS.md`
  with project-specific rules (structure, engine/UI separation,
  `features/` usage). No app code touched. See `PROJECT_MAP.md`,
  `PRODUCT_CONSTITUTION.md`, `SYSTEM_ARCHITECTURE.md`.
