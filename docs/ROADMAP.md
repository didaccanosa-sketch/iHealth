# Roadmap

Granular, day-to-day task tracking lives in `TODO.md` (Spanish) — that's
the live source of truth, don't duplicate it here. This file is just the
macro sequence.

## Phases

1. **V1 (current)** — per-module manual engines (Nutrition, Training) with
   direct Supabase access. No orchestration layer. This is the "free tier,"
   full manual control — stays as the base even after later phases.
2. **User Model + Goal Engine** — introduce shared user state under
   `features/goal/` and `features/profile/`, without touching V1 module
   behavior.
3. **Recommendation Engine** — orchestrator that reads the User Model and
   coordinates Workout/Nutrition/Recovery/Insights engines. Noted in
   `TODO.md` as a future paid-tier feature — not being built during V1.
4. **Incremental migration** — existing `lib/engine/*` logic gets pulled
   into `features/*/engine` one module at a time, only when that module is
   actively being touched. Never a single big migration.

Check `TODO.md` for what's actually in progress right now.
