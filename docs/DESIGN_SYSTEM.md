# Design System

Source of truth for tokens (colors, spacing, etc.) is `constants/theme.ts` —
don't duplicate values here, read that file when you need the actual tokens.

## Shared UI primitives

Reusable, non-domain-specific components live in `components/`:

- `Screen.tsx` — screen wrapper/layout.
- `Card.tsx` — card container.
- `FadeIn.tsx` — entry animation wrapper.
- `MacroBar.tsx` — progress bar (used by Nutrition, generic enough to reuse
  elsewhere).
- `AuthScreen.tsx` — login/register.

Domain-specific components (e.g. training screens) live in their own
subfolder (`components/training/`), not mixed in with the shared primitives.

Fill this file in with actual visual guidelines (spacing scale, typography,
color usage rules) once there's more than one module's worth of UI to keep
consistent — currently premature to formalize.
