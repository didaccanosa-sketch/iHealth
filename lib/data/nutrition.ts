import { supabase } from '../supabase';
import { Meal, MacroGoals } from '../engine/types';
import { computeNutritionInsightFacts, nutritionInsightSignature } from '../engine/nutritionInsight';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchMealsForDate(date: string = todayKey()): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('id, description, kcal, protein_g, carbs_g, fat_g, fiber_g, source, meal_slot, logged_at, logged_time')
    .eq('logged_at', date)
    .order('logged_time', { ascending: true });
  if (error) throw error;
  return (data as Meal[]) || [];
}

// Comidas de un rango de fechas (usado para calcular la tendencia del Insight
// Engine) — `fromDate` inclusivo, `toDate` exclusivo.
export async function fetchMealsForDateRange(fromDate: string, toDate: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('id, description, kcal, protein_g, carbs_g, fat_g, fiber_g, source, meal_slot, logged_at, logged_time')
    .gte('logged_at', fromDate)
    .lt('logged_at', toDate)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data as Meal[]) || [];
}

// ─── OBJETIVO DE MACROS ─────────────────────────────────────────────────────
// Histórico por fecha (ver schema.sql) — nunca se edita una fila, cada cambio
// de objetivo inserta una nueva. "El objetivo actual" es siempre la más reciente.

export async function fetchCurrentMacroGoal(userId: string): Promise<MacroGoals | null> {
  const { data, error } = await supabase
    .from('macro_goals')
    .select('kcal, protein_g, carbs_g, fat_g, fiber_g')
    .eq('user_id', userId)
    .order('set_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MacroGoals) || null;
}

export async function saveMacroGoal(
  userId: string,
  goal: MacroGoals,
  source: 'manual' | 'recommendation_engine' = 'manual'
): Promise<MacroGoals> {
  const { data, error } = await supabase
    .from('macro_goals')
    .insert({ ...goal, user_id: userId, source })
    .select('kcal, protein_g, carbs_g, fat_g, fiber_g')
    .single();
  if (error) throw error;
  return data as MacroGoals;
}

export type NewMeal = {
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: 'chat' | 'photo' | 'template';
  meal_slot: number;
};

export async function insertMeal(userId: string, meal: NewMeal, date: string = todayKey()) {
  const { data, error } = await supabase
    .from('meals')
    .insert({ ...meal, user_id: userId, logged_at: date })
    .select()
    .single();
  if (error) throw error;
  return data as Meal;
}

export async function updateMeal(id: string, patch: Partial<NewMeal>) {
  const { data, error } = await supabase.from('meals').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Meal;
}

export async function deleteMeal(id: string) {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateMeal(meal: Meal, userId: string, targetSlot: number, date: string = todayKey()) {
  return insertMeal(
    userId,
    {
      description: meal.description,
      kcal: meal.kcal,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      fiber_g: meal.fiber_g,
      source: 'template',
      meal_slot: targetSlot,
    },
    date
  );
}

export async function saveMealAsTemplate(userId: string, meal: Meal) {
  const { error } = await supabase.from('meal_templates').insert({
    user_id: userId,
    description: meal.description,
    kcal: meal.kcal,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    fiber_g: meal.fiber_g,
  });
  if (error) throw error;
}

export type MealTemplate = {
  id: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export async function fetchMealTemplates(userId: string): Promise<MealTemplate[]> {
  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteMealTemplate(id: string) {
  const { error } = await supabase.from('meal_templates').delete().eq('id', id);
  if (error) throw error;
}

// Llama a la Edge Function de Supabase que analiza el texto de la comida con
// IA (ver supabase/functions/analyze-meal). La API key de Anthropic nunca
// viaja al móvil — solo vive en el servidor de Supabase.
export async function analyzeMealText(text: string): Promise<{
  desc: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}> {
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { text },
  });
  if (error) throw error;
  return data;
}

// ─── Plantillas de día completo (varias comidas juntas de una vez) ──────────
export type DayTemplateMeal = {
  meal_slot: number;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type DayTemplate = {
  id: string;
  name: string;
  meals: DayTemplateMeal[];
};

export async function saveDayAsTemplate(userId: string, name: string, meals: Meal[]) {
  const { data: tmpl, error } = await supabase
    .from('day_templates')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (error) throw error;

  const rows = meals.map((m) => ({
    day_template_id: tmpl.id,
    user_id: userId,
    meal_slot: m.meal_slot,
    description: m.description,
    kcal: m.kcal,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    fiber_g: m.fiber_g,
  }));
  const { error: errMeals } = await supabase.from('day_template_meals').insert(rows);
  if (errMeals) throw errMeals;
}

export async function fetchDayTemplates(userId: string): Promise<DayTemplate[]> {
  const { data: templates, error } = await supabase
    .from('day_templates')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!templates || !templates.length) return [];

  const { data: meals, error: errMeals } = await supabase
    .from('day_template_meals')
    .select('day_template_id, meal_slot, description, kcal, protein_g, carbs_g, fat_g, fiber_g')
    .in(
      'day_template_id',
      templates.map((t: any) => t.id)
    );
  if (errMeals) throw errMeals;

  return templates.map((t: any) => ({
    id: t.id,
    name: t.name,
    meals: (meals || [])
      .filter((m: any) => m.day_template_id === t.id)
      .sort((a: any, b: any) => a.meal_slot - b.meal_slot)
      .map((m: any) => ({
        meal_slot: m.meal_slot,
        description: m.description,
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        fiber_g: m.fiber_g,
      })),
  }));
}

export async function applyDayTemplate(userId: string, template: DayTemplate, date: string = todayKey()) {
  for (const m of template.meals) {
    await insertMeal(
      userId,
      {
        description: m.description,
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        fiber_g: m.fiber_g,
        source: 'template',
        meal_slot: m.meal_slot,
      },
      date
    );
  }
}

export async function deleteDayTemplate(id: string) {
  const { error } = await supabase.from('day_templates').delete().eq('id', id);
  if (error) throw error;
}

// ─── NUTRITION INSIGHT ENGINE ────────────────────────────────────────────────
// Frase corta tipo "entrenador" de la pantalla Today, generada con IA a partir
// de hechos calculados en el motor (ver lib/engine/nutritionInsight.ts) y
// cacheada un día a la vez para no llamar a la IA en cada visita.

type CachedInsight = { line: string; meals_signature: string | null };

async function fetchCachedNutritionInsight(date: string): Promise<CachedInsight | null> {
  const { data, error } = await supabase
    .from('nutrition_insights')
    .select('line, meals_signature')
    .eq('logged_at', date)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertNutritionInsight(
  userId: string,
  date: string,
  line: string,
  source: 'ai' | 'fallback',
  signature: string
) {
  const { error } = await supabase
    .from('nutrition_insights')
    .upsert(
      { user_id: userId, logged_at: date, line, source, meals_signature: signature },
      { onConflict: 'user_id,logged_at' }
    );
  if (error) throw error;
}

// Llama a la Edge Function que redacta la frase con IA a partir de los hechos
// ya calculados (nunca comidas en crudo — ver supabase/functions/nutrition-insight).
async function generateNutritionInsightLine(facts: ReturnType<typeof computeNutritionInsightFacts>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nutrition-insight', {
    body: { facts },
  });
  if (error) throw error;
  if (!data?.line) throw new Error('Empty insight response');
  return data.line as string;
}

// Punto de entrada único para la pantalla Today: devuelve la frase a mostrar
// y de dónde vino ('cached' | 'ai' | 'fallback'). Nunca lanza — si la IA falla
// (sin red, cuota, función no desplegada...) cae al texto de reglas fijas que
// se le pase como `fallbackLine`, sin romper la pantalla.
export async function getNutritionInsight(
  userId: string,
  todayMeals: Meal[],
  recentDaysMeals: Meal[][],
  goals: MacroGoals,
  fallbackLine: string,
  date: string = todayKey()
): Promise<{ line: string; source: 'cached' | 'ai' | 'fallback' }> {
  const signature = nutritionInsightSignature(todayMeals, recentDaysMeals);

  try {
    const cached = await fetchCachedNutritionInsight(date);
    if (cached && cached.meals_signature === signature) {
      return { line: cached.line, source: 'cached' };
    }
  } catch {
    // si falla la lectura de caché, seguimos e intentamos generar una nueva
  }

  try {
    const facts = computeNutritionInsightFacts(todayMeals, recentDaysMeals, goals);
    const line = await generateNutritionInsightLine(facts);
    upsertNutritionInsight(userId, date, line, 'ai', signature).catch(() => {
      // el cacheo es una optimización, no algo crítico — si falla, no pasa nada
    });
    return { line, source: 'ai' };
  } catch {
    return { line: fallbackLine, source: 'fallback' };
  }
}
