// Flag en memoria (no persistido) para que "saltar el onboarding" no te
// devuelva ahí mismo cada vez que la pantalla única detecta que aún no hay
// objetivo. Dura solo la sesión de la app — si la cierras y la vuelves a
// abrir sin haber fijado objetivo, el onboarding vuelve a aparecer. Ver
// docs/SIMPLIFIED_VISION.md — decisión simple a propósito, sin tabla nueva.
let skipped = false;

export function markOnboardingSkipped(): void {
  skipped = true;
}

export function wasOnboardingSkipped(): boolean {
  return skipped;
}
