// Nutrition Insight Engine — pieza pura (sin Supabase, sin React Native).
//
// Principio (el mismo que en el diseño del User Model): la IA no es la base de
// datos, solo redacta. Aquí calculamos los HECHOS del día (categorías, no
// números crudos) a partir de las comidas reales; la IA solo los convierte en
// una frase natural (ver supabase/functions/nutrition-insight). Así la frase
// nunca puede "inventar" un dato que no esté aquí, y si la IA falla, las
// reglas fijas de `nutritionCoachLine` siguen sirviendo de plan B.

import { MacroGoals, Meal } from './types';
import { computeMacroStatus, DEFAULT_GOALS } from './nutrition-engine';

export type NutritionInsightFacts = {
  mealsLoggedToday: number;
  calorieStatus: 'no_data' | 'far_under' | 'under' | 'on_track' | 'over';
  proteinStatus: 'low' | 'ok' | 'goal_met';
  fiberStatus: 'low' | 'ok';
  trend: 'improving' | 'stable' | 'declining' | 'not_enough_data';
};

// Agrupa una lista plana de comidas (p.ej. de varios días) en un array de
// arrays por día, ordenado con el día más reciente primero.
export function groupMealsByDate(meals: Meal[]): Meal[][] {
  const byDate = new Map<string, Meal[]>();
  for (const m of meals) {
    const list = byDate.get(m.logged_at) || [];
    list.push(m);
    byDate.set(m.logged_at, list);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // descendente: más reciente primero
    .map(([, ms]) => ms);
}

// Huella simple de un conjunto de comidas — sirve para saber si hay que
// regenerar la frase (ha cambiado algo) o si el día sigue igual que cuando se
// generó la última vez.
export function nutritionInsightSignature(meals: Meal[], recentDaysMeals: Meal[][] = []): string {
  const today = meals
    .map((m) => `${m.id}:${m.kcal}:${m.protein_g}`)
    .sort()
    .join('|');
  const recent = recentDaysMeals
    .map((day) => day.map((m) => `${m.id}:${m.kcal}:${m.protein_g}`).sort().join(','))
    .join('|');
  return `${today}::${recent}`;
}

export function computeNutritionInsightFacts(
  todayMeals: Meal[],
  recentDaysMeals: Meal[][], // días anteriores, más reciente primero (ver groupMealsByDate)
  goals: MacroGoals = DEFAULT_GOALS
): NutritionInsightFacts {
  const status = computeMacroStatus(todayMeals, goals);
  const { remaining, pct } = status;

  const calorieStatus: NutritionInsightFacts['calorieStatus'] =
    todayMeals.length === 0
      ? 'no_data'
      : pct.kcal >= 1.1
      ? 'over'
      : pct.kcal >= 0.9
      ? 'on_track'
      : pct.kcal >= 0.5
      ? 'under'
      : 'far_under';

  const proteinStatus: NutritionInsightFacts['proteinStatus'] =
    pct.protein_g >= 1 ? 'goal_met' : remaining.protein_g > 40 ? 'low' : 'ok';

  const fiberStatus: NutritionInsightFacts['fiberStatus'] = remaining.fiber_g > 15 ? 'low' : 'ok';

  // Tendencia aproximada: compara el % de proteína alcanzado en los días con
  // datos, del más antiguo al más reciente. Solo de contexto, no un cálculo
  // exacto — necesita al menos 2 días con comidas registradas.
  let trend: NutritionInsightFacts['trend'] = 'not_enough_data';
  const validDays = recentDaysMeals.filter((d) => d.length > 0);
  if (validDays.length >= 2) {
    const pcts = validDays.map((d) => computeMacroStatus(d, goals).pct.protein_g);
    const oldest = pcts[pcts.length - 1];
    const mostRecent = pcts[0];
    if (mostRecent - oldest > 0.1) trend = 'improving';
    else if (oldest - mostRecent > 0.1) trend = 'declining';
    else trend = 'stable';
  }

  return {
    mealsLoggedToday: todayMeals.length,
    calorieStatus,
    proteinStatus,
    fiberStatus,
    trend,
  };
}
