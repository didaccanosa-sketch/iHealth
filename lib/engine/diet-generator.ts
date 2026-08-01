// Generador de menú determinista — pura, sin Supabase/IA (mismo patrón que
// el resto de lib/engine/). Reparte gramos entre categorías del catálogo
// genérico (food-db.ts) hasta acercarse al objetivo de macros que ya
// calculó el Strategy Planner, y lo divide entre las comidas del día.
// Nunca decide el objetivo (eso ya viene calculado) — solo traduce
// calorías/macros en una propuesta concreta y genérica, igual que
// buildFocusSplit hace con los días de entreno.
import { FOOD_CATEGORIES, FoodCategory } from './food-db';
import { DietaryPattern } from '../../features/profile/engine/types';

export type DietMeal = {
  slot: number;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type DietPlan = {
  meals: DietMeal[];
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
};

export type DietTargets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  mealsPerDay: number;
};

type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
    fiber_g: a.fiber_g + b.fiber_g,
  };
}

// Gramos de una categoría necesarios para aportar `grams_of_macro` de un
// macro concreto — nunca negativo, y si la categoría no aporta nada de ese
// macro (ej. legumbre para grasa) devuelve 0 en vez de dividir por cero.
function gramsForMacro(category: FoodCategory, macroTarget: number, macro: keyof Macros): number {
  const per100 = FOOD_CATEGORIES[category].per100g[macro];
  if (macroTarget <= 0 || per100 <= 0) return 0;
  return (macroTarget / per100) * 100;
}

function macrosForGrams(category: FoodCategory, grams: number): Macros {
  const per100 = FOOD_CATEGORIES[category].per100g;
  const factor = grams / 100;
  return {
    kcal: per100.kcal * factor,
    protein_g: per100.protein_g * factor,
    carbs_g: per100.carbs_g * factor,
    fat_g: per100.fat_g * factor,
    fiber_g: per100.fiber_g * factor,
  };
}

// Qué categorías de proteína entran en juego y en qué proporción, según la
// preferencia dietética ya guardada en el perfil (NutritionModel.dietaryPattern).
// Sin preferencia guardada, se trata como 'omnivore'.
function proteinSourcesFor(pattern: DietaryPattern | null): { category: FoodCategory; share: number }[] {
  switch (pattern) {
    case 'vegan':
      return [{ category: 'legume', share: 1 }];
    case 'vegetarian':
      return [
        { category: 'dairy_protein', share: 0.5 },
        { category: 'legume', share: 0.5 },
      ];
    case 'pescatarian':
    case 'omnivore':
    case 'other':
    default:
      return [
        { category: 'animal_protein', share: 0.7 },
        { category: 'legume', share: 0.3 },
      ];
  }
}

// Reparto fijo de carbohidratos entre grano/tubérculo/fruta — genérico a
// propósito, no intenta adivinar preferencias más finas que la dietética.
const CARB_SOURCES: { category: FoodCategory; share: number }[] = [
  { category: 'grain', share: 0.6 },
  { category: 'tuber', share: 0.25 },
  { category: 'fruit', share: 0.15 },
];

// Verdura: ración fija por comida, no se calcula para encajar un macro
// exacto — aporta poco y su función real es fibra/saciedad, no macros de
// precisión (ver conversación de diseño).
const VEGETABLE_GRAMS_PER_MEAL = 100;

export function computeDietPlan(targets: DietTargets, dietaryPattern: DietaryPattern | null = null): DietPlan {
  const mealsPerDay = Math.max(1, targets.mealsPerDay);

  // 1. Proteína — reparte el objetivo completo entre las categorías que
  // tocan según la dieta.
  const proteinSources = proteinSourcesFor(dietaryPattern);
  const proteinGrams: { category: FoodCategory; grams: number }[] = proteinSources.map((s) => ({
    category: s.category,
    grams: gramsForMacro(s.category, targets.protein_g * s.share, 'protein_g'),
  }));
  let consumed = proteinGrams.reduce((sum, g) => addMacros(sum, macrosForGrams(g.category, g.grams)), ZERO);

  // 2. Carbohidratos — lo que falte del objetivo tras contar lo que ya
  // aportó la proteína (ej. legumbre trae carbohidratos de serie).
  const remainingCarbs = Math.max(0, targets.carbs_g - consumed.carbs_g);
  const carbGrams: { category: FoodCategory; grams: number }[] = CARB_SOURCES.map((s) => ({
    category: s.category,
    grams: gramsForMacro(s.category, remainingCarbs * s.share, 'carbs_g'),
  }));
  consumed = carbGrams.reduce((sum, g) => addMacros(sum, macrosForGrams(g.category, g.grams)), consumed);

  // 3. Verdura — ración fija (no calculada), se suma igualmente a los
  // totales para que la propuesta no infravalore lo que aporta.
  const vegetableGrams = VEGETABLE_GRAMS_PER_MEAL * mealsPerDay;
  consumed = addMacros(consumed, macrosForGrams('vegetable', vegetableGrams));

  // 4. Grasa — lo que falte tras proteína/carbohidratos/verdura, vía grasa
  // saludable. Nunca negativo: si ya se pasó de grasa con lo anterior
  // (categorías con algo de grasa de serie), simplemente no añade más.
  const remainingFat = Math.max(0, targets.fat_g - consumed.fat_g);
  const healthyFatGrams = gramsForMacro('healthy_fat', remainingFat, 'fat_g');
  consumed = addMacros(consumed, macrosForGrams('healthy_fat', healthyFatGrams));

  // ─── Reparto entre comidas ────────────────────────────────────────────
  const healthyFatEntry: { category: FoodCategory; grams: number } = { category: 'healthy_fat', grams: healthyFatGrams };
  const perMealGrams: { category: FoodCategory; grams: number }[] = [...proteinGrams, ...carbGrams, healthyFatEntry]
    .filter((g) => g.grams >= 5) // categorías con una cantidad insignificante no aparecen en la propuesta
    .map((g) => ({ category: g.category, grams: Math.round(g.grams / mealsPerDay / 5) * 5 })); // redondeado a 5g

  const meals: DietMeal[] = [];
  for (let slot = 1; slot <= mealsPerDay; slot++) {
    let mealMacros: Macros = macrosForGrams('vegetable', VEGETABLE_GRAMS_PER_MEAL);
    const parts: string[] = [];
    for (const g of perMealGrams) {
      if (g.grams <= 0) continue;
      mealMacros = addMacros(mealMacros, macrosForGrams(g.category, g.grams));
      parts.push(`${g.grams}g ${FOOD_CATEGORIES[g.category].label} (${FOOD_CATEGORIES[g.category].examples})`);
    }
    parts.push(`verdura al gusto (${FOOD_CATEGORIES.vegetable.examples})`);

    meals.push({
      slot,
      description: parts.join(', '),
      kcal: Math.round(mealMacros.kcal),
      protein_g: Math.round(mealMacros.protein_g),
      carbs_g: Math.round(mealMacros.carbs_g),
      fat_g: Math.round(mealMacros.fat_g),
      fiber_g: Math.round(mealMacros.fiber_g),
    });
  }

  const totals = meals.reduce(
    (sum, m) => addMacros(sum, { kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fiber_g: m.fiber_g }),
    ZERO
  );

  return { meals, totals: { kcal: Math.round(totals.kcal), protein_g: Math.round(totals.protein_g), carbs_g: Math.round(totals.carbs_g), fat_g: Math.round(totals.fat_g), fiber_g: Math.round(totals.fiber_g) } };
}
