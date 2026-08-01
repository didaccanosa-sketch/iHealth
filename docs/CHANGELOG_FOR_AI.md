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
