# Recommendation Engine

Design closed 2026-08-01. Not built yet — see `TODO.md` for build order.
This is the target for the orchestrator layer described in
`docs/SYSTEM_ARCHITECTURE.md`.

## Purpose

The Recommendation Engine is the central orchestrator of the app, and — as
of this design — the only path into Nutrition/Workout planning (the
monetization split mentioned in earlier notes is shelved, not decided).

It does **not** generate workouts or nutrition plans itself. It decides
the *strategy* (what the user should do) and delegates the *execution*
(how) to the specialized engines. Each domain engine keeps solving one
problem only, and domain engines never talk to each other — only the
Recommendation Engine has the global view.

Recommendation Engine = decides WHAT.
Workout Engine = decides HOW to train.
Nutrition Engine = decides HOW to eat.
Recovery Engine = decides HOW to recover.

## High-level flow

```
User
  ↓
Goal Engine
  ↓
User Model
  ↓
Recommendation Engine
  ↓
Workout Engine · Nutrition Engine · Recovery Engine
  ↓
Daily Recommendations
  ↓
Home Screen (Today)
```

Matches the target diagram in `docs/SYSTEM_ARCHITECTURE.md`.

## The manual wizard doesn't disappear

Nothing is ever saved automatically. Every proposal (macro goal,
mesocycle, daily plan) is shown to the user for review first. The
mesocycle wizard that exists today isn't a separate path anymore — it
**is** this review/edit step. The user always ends up looking at the same
kind of editable proposal, whether it came from the engine or they're
adjusting it by hand.

### How manual edits feed back

- **One-off edit**: used as-is for that proposal, no lasting effect.
- **Repeated pattern**: if the user overrides the same parameter in the
  same direction several times (e.g. always lowers proposed frequency,
  always raises calories), that's a real preference signal — it gets
  written into the User Model's `Adherence` category (already defined in
  `features/profile/engine/types.ts`, currently empty) and the Strategy
  Planner takes it into account on the next run. No reaction to a single
  edit — mirrors the "don't overreact" rule for dynamic adaptation below.

## Responsibilities

- Understand the user's goal (via Goal Engine's structured objective).
- Read the complete User Model.
- Build the long-term strategy.
- Translate that strategy into concrete parameters per domain engine.
- Validate consistency between what the domain engines produce.
- Generate the daily plan for Today.
- Adapt the strategy over time, cautiously.

## Inputs

**Goal Engine**: goal type, target date, evaluation (trend/status/confidence).

**User Model**: identity, training history, nutrition history, lifestyle,
schedule, preferences, experience, restrictions, equipment, motivation,
adherence, confidence per field.

**Historical data**: weight evolution, workout adherence, nutrition
adherence, previous recommendations, body response — read via the
existing domain engines (Goal, Recovery), not duplicated here.

## Internal pipeline

### 1 — Goal interpretation
Turn what the user said/picked ("I want to lose 8kg", a preset) into a
structured objective. Free-text interpretation is one of the few places
AI is allowed (see AI usage below).

### 2 — Context builder
Load everything relevant from the User Model. No decisions yet, just
assembling the full current state.

### 3 — Strategy Planner (the core)
Decides **what** the user should do. Deterministic — no AI. Output
example: daily calories, protein/fat/carb/fiber targets, meals per day,
workout frequency, weekly volume priorities per muscle group, cardio
sessions/week (logic already documented in `TODO.md`), recovery
priorities, sleep target, daily steps target.

**Not included here**: the day-by-day split (which muscle groups land on
which day). That stays inside the Workout Engine — it already has a
working algorithm for this (`explainFocusChoices`, focus priority). The
Strategy Planner hands down frequency + volume priorities; the Workout
Engine decides the concrete arrangement. Keeps the existing, working
logic in one place instead of duplicating it upstream.

### 4 — Delegation
- **Workout Engine** receives: frequency, goal/phase, volume priorities,
  available time, equipment, experience, recovery constraints. Produces
  the actual program.
- **Nutrition Engine** receives: calories, macros, fiber, meal frequency,
  dietary preferences, restrictions. Produces the meal plan/targets.
- **Recovery Engine** receives: recovery goals, sleep target, fatigue
  limits. Produces recovery recommendations.

### 5 — Validation
Check the outputs are coherent with each other before showing them.
Examples: 5 workouts/week + a 1200 kcal target is unrealistic; beginner
experience + advanced volume is invalid; night-shift lifestyle + a 6am
workout suggestion is a bad fit.

If the Recommendation Engine adjusts something to resolve a conflict, it
must say why — silently changing a number is not acceptable (same
transparency bar as the rest of the app).

### 6 — Daily planning
Turn the long-term strategy into today's concrete plan: today's workout,
today's nutrition targets, today's focus, today's recovery goal, today's
highest-impact action. This is what feeds the Today screen.

## Planning horizons

- **Long-term** (the destination): lose 10kg, gain muscle, improve health.
- **Mid-term** (the strategy): 500 kcal deficit, 4 workouts/week, 8000
  steps/day, 30g fiber/day.
- **Short-term** (today's execution): upper-body workout, 2200 kcal, 160g
  protein, 20 min walk, 2L water.

## Dynamic adaptation

The strategy updates based on real behavior: missed workouts, poor
adherence, a weight plateau, faster-than-expected progress, lifestyle
changes, an updated goal.

Guardrails (open question flagged during design, revisit once this is
actually running and we can see if it's too much or not enough):
- Some adjustments can apply automatically, but conservatively — nothing
  drastic without review.
- **Rate-limited**: don't replan more than once a week, so it doesn't
  feel naggy.
- Same "no silent changes" rule as Validation — if the strategy shifts,
  say why.

## Prerequisites not built yet

These need to exist before the corresponding piece of the engine can be
real (tracked in `TODO.md`):
- Per-user persisted macro goal (today it's a fixed constant for everyone).
- Water and sleep tracking (needed for sleep target / hydration outputs).
- Daily steps tracking.
- Cardio and Functional as actual engines (today only Hypertrophy/Strength
  training exists).
- The AI redaction functions themselves (pattern already proven by
  `analyze-meal` / `nutrition-insight`, just not written for this yet).

## AI usage

AI only where interpretation or reasoning is genuinely needed:
understanding free-text goals, interpreting onboarding conversation,
detecting contradictions, explaining a recommendation in natural language.

**Never** for deterministic calculation. Calories, macros, adherence
scores, progression, and the Strategy Planner's numbers are always
computed in code — same principle as every other engine in this app (see
`lib/engine/nutritionInsight.ts` for the existing pattern: facts computed
in pure code, AI only turns them into a sentence, with a fixed fallback if
the AI call fails).

## Design philosophy

One question drives every decision here: *given everything we know about
this user, what's the best strategy to maximize their odds of reaching
their goal?*

Domain engines never decide strategy — they only turn a given strategy
into an executable plan. This separation holds everywhere in the app.
