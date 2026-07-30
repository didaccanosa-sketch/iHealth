import { supabase } from '../supabase';
import { Meal } from '../engine/types';

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

export async function fetchMealTemplates(userId: string) {
  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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
