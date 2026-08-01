# User Model

Central store of everything the app knows about a user. Every engine
(Goal, Recommendation, Workout, Nutrition, Recovery, Insights...) is meant
to read from this instead of storing user-specific personalization data
independently. It lives in `features/profile/` and wraps — doesn't
replace — `profiles` (account data) and each domain engine's own tables.

The UI never writes to the User Model directly. It always goes through
`setField` (`features/profile/engine/user-model.ts`) or the Question
Engine's `applyAnswer` — both stamp `status: 'confirmed'` and `updatedAt`
themselves, callers don't fabricate a `Field` by hand.

## Schema

One row per user in `user_model` (`supabase/schema.sql`), one `data jsonb`
column. Every leaf field is:

```json
{ "value": ..., "status": "unknown" | "confirmed", "updatedAt": "..." | null }
```

Why jsonb instead of a table per field: Postgres can query inside jsonb
natively (indexable with GIN later if cross-user analytics ever need it),
and it's far simpler to read/write today. If a specific field gets "hot"
with real usage, it can be pulled out into its own column later without
touching the rest of the model.

## Status: v1 is Unknown/Confirmed only

No confidence score (0-1), no `Estimated`/`Outdated` states. A field is
either `unknown` or `confirmed` — confirmed always wins over unknown, and
nothing ever un-confirms a field automatically. This was a deliberate
scope cut: confidence scoring needs real design work (how is it computed
per field/inference type, what replaces what) that isn't justified until
there's a concrete signal that needs it. Revisit if/when that happens.

## Categories

Defined in `features/profile/engine/types.ts`. Ten categories total —
six have real fields today, four are stubs reserved for later:

**With content (v1):**
- `identity` — firstName, lastName, age, sex, heightCm,
  startingWeightKg. Edited by hand in `app/profile.tsx`, never asked via
  the Question Engine. Saving also writes the combined full name into
  `profiles.name` (via `syncIdentityToLegacyProfile`) so Today's greeting
  picks it up through the existing `fetchProfile` read — no changes
  needed there.
- `goals` — type, targetWeightKg, targetDate.
- `training` — experience, daysPerWeek, equipment, preferredExercises,
  dislikedExercises, injuries.
- `nutrition` — mealsPerDay, dislikedFoods, allergies, dietaryPattern.
- `lifestyle` — workType, dailyActivity, sleepHours,
  preferredTrainingTime, sessionLengthMin.
- `adherence` — consistencyScore, workoutsCompletedRatio,
  mealsLoggedRatio, currentStreakDays, lastActiveAt. Never asked — meant
  to be filled by other engines from real behavior (sessions completed,
  meals logged). **The actual auto-fill hooks aren't wired yet** — this
  pass only defines the fields and leaves `setField` ready for them.

**Stubs, no fields yet:** `body`, `motivation`, `preferences`, `health`.
Add fields to these only when a concrete piece of work needs them —
don't design them speculatively. `health` in particular needs its own
decision before it gets anything (how it's stored, whether it's ever
passed to an AI prompt, whether it belongs in the same generic jsonb at
all) — treat it as a separate conversation, not a default extension of
this pattern.

## Legacy fields in `profiles`

`height_cm`, `starting_weight_kg`, `preferred_training_days` still live in
`profiles` and are still read directly by `TemplatePicker` and Today
(`lib/data/profile.ts` — untouched). `user_model` is additive on top:

- `loadUserModel` (`features/profile/data/user-model-data.ts`) reads
  `user_model` and, the first time, backfills any `unknown` identity/
  training field from the legacy `profiles` columns — one-way, read-time
  migration, no schema change to `profiles`. `profiles.name` (a single
  free-text field) is dropped whole into `identity.firstName` as a
  starting point; the user splits it into first/last name properly the
  first time they open Profile.
- `app/profile.tsx` writes to `user_model` first (source of truth going
  forward), then dual-writes the same values back into `profiles` via
  `syncIdentityToLegacyProfile` so the existing readers keep working
  without modification.

Don't remove the `profiles` columns or `lib/data/profile.ts` functions —
that's a separate cleanup task once every reader has moved to
`user_model`, not a side effect of this one.

## Question Engine

`features/profile/engine/questions.ts` — a plain declarative array
(`QUESTIONS`), no AI involved in generating or picking questions. Each
question has `category`, `field`, `answerType`, `options`, `priority`,
and an optional `condition(model)` to gate questions that don't make
sense yet (e.g. a target weight question only fires once a goal type is
set). `getNextQuestions(model, count)` filters to `unknown` fields whose
condition passes, sorts by `priority`, and returns at most `count` — the
caller decides how many to surface at once.

v1 only has questions for `goals`, `training`, `nutrition`, `lifestyle`.
`identity` is a direct-edit form, not a question flow. `adherence` is
inferred, never asked.

Three answer types: `single_choice` (fixed options, no ambiguity — kept
deliberately minimal, e.g. training equipment has a "depends on the day /
mix" option instead of open text), `number` (typed input, e.g. target
weight), and `text` (free text for fields that are genuinely open-ended —
injuries, allergies). `text` answers go through
`supabase/functions/analyze-profile-answer` (same pattern as
`analyze-meal`/`analyze-cardio`) to normalize typos/phrasing into a clean
list of tags before saving; if that call fails or the function isn't
deployed yet, it falls back to a local comma-split of the raw text so
nothing is lost. Needs `supabase functions deploy analyze-profile-answer`
to actually run — until then every `text` answer just uses the local
fallback.

There's no dedicated question screen. `features/profile/QuestionCard.tsx`
renders one question at a time and is embedded straight into Today
(`app/(tabs)/index.tsx`) — a discrete card, not a flow the user has to
finish. This is intentional progressive profiling: never ask everything
at once, only ask what's still `unknown` and relevant right now.

## What's explicitly not built yet

- **Goal Chat** (conversational onboarding: free-text goal → AI extracts
  structured fields). `features/goal/` is still empty. This is the next
  piece to build on top of the User Model, not part of it.
- **Auto-fill from other engines.** The plan (per `TODO.md`) is that any
  real action anywhere in the app should confirm relevant fields
  automatically (e.g. creating a mesocycle confirms
  `training.experience`/`daysPerWeek`, completing/skipping sessions feeds
  `adherence`). None of those hooks exist yet — `setField` is ready to be
  called from `workout-engine`/`nutrition-engine`, but nothing calls it
  there today.
- **Recommendation Engine integration.** Nothing reads the User Model to
  make a recommendation yet — there's no Recommendation Engine built.
- **Rest of the Profile screen.** `app/profile.tsx` has the Identity
  section plus a "Settings" card with Email/Password/Theme/Log out rows
  shown as disabled "Coming soon" placeholders — none of them are wired
  up yet, that's a separate task. Profile photo is intentionally left out
  for now (needs Supabase Storage — its own piece of work).
- **Confidence scoring, Estimated/Outdated states** — see above.
- **`body`, `motivation`, `preferences`, `health`** categories — stubs
  only, no fields, no questions.
