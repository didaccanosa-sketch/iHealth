import { Macros, MacroGoals, MacroStatus, Meal } from './types';

// TODO: estos objetivos deberían salir del Goal Engine (TDEE calculado a partir
// de peso, altura, actividad y objetivo del usuario). De momento son un valor
// fijo razonable, igual que en la versión web, hasta que construyamos esa pieza.
export const DEFAULT_GOALS: MacroGoals = {
  kcal: 2900,
  protein_g: 155,
  carbs_g: 320,
  fat_g: 90,
  fiber_g: 30,
};

export function sumMacros(meals: Pick<Meal, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>[]): Macros {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      protein_g: acc.protein_g + (m.protein_g || 0),
      carbs_g: acc.carbs_g + (m.carbs_g || 0),
      fat_g: acc.fat_g + (m.fat_g || 0),
      fiber_g: acc.fiber_g + (m.fiber_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );
}

export function computeMacroStatus(meals: Meal[], goals: MacroGoals = DEFAULT_GOALS): MacroStatus {
  const totals = sumMacros(meals);
  const remaining: Macros = {
    kcal: goals.kcal - totals.kcal,
    protein_g: goals.protein_g - totals.protein_g,
    carbs_g: goals.carbs_g - totals.carbs_g,
    fat_g: goals.fat_g - totals.fat_g,
    fiber_g: goals.fiber_g - totals.fiber_g,
  };
  const pct = {
    kcal: clampPct(totals.kcal, goals.kcal),
    protein_g: clampPct(totals.protein_g, goals.protein_g),
    carbs_g: clampPct(totals.carbs_g, goals.carbs_g),
    fat_g: clampPct(totals.fat_g, goals.fat_g),
    fiber_g: clampPct(totals.fiber_g, goals.fiber_g),
  };
  return { totals, goals, remaining, pct };
}

function clampPct(value: number, goal: number): number {
  if (!goal) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

// Genera el texto corto tipo "entrenador personal" que pide el documento de
// producto (corto, accionable, contextual) — de momento con reglas fijas;
// más adelante esto puede sustituirse por una llamada al Insight Engine (IA).
export function nutritionCoachLine(status: MacroStatus): string {
  const { remaining, pct } = status;
  if (pct.kcal >= 1) return 'Ya has llegado a tu objetivo de calorías de hoy.';
  if (remaining.protein_g > 40) {
    return `Vas ${Math.round(remaining.protein_g)}g de proteína por debajo — prioriza una comida rica en proteína.`;
  }
  if (remaining.kcal < 200 && remaining.kcal > 0) {
    return 'Estás muy cerca de tu objetivo de hoy, un pequeño extra y lo cierras.';
  }
  if (remaining.fiber_g > 15) {
    return 'Te falta bastante fibra hoy — fruta, verdura o legumbre te ayudaría.';
  }
  return `Te quedan ~${Math.round(remaining.kcal)} kcal y ${Math.round(remaining.protein_g)}g de proteína para hoy.`;
}
