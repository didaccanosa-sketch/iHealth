// Llama a la Edge Function que interpreta el texto libre del Goal Chat (ver
// supabase/functions/interpret-goal y TODO.md, sección "Goal Chat"). Nunca
// adivina: si el resultado no es interpretable devuelve null, y la UI
// (GoalCard) debe pedir al usuario que lo reintente en vez de guardar algo
// a medias.
import { supabase } from '../../lib/supabase';
import type { GoalType } from '../../features/profile/engine/types';

export type InterpretedGoal = {
  type: GoalType;
  targetWeightKg?: number;
  targetDate?: string;
  targetExercise?: string;
  targetExerciseKg?: number;
};

export async function interpretGoalText(text: string): Promise<InterpretedGoal | null> {
  const { data, error } = await supabase.functions.invoke('interpret-goal', {
    body: { text },
  });
  if (error) throw error;
  if (!data || data.error) return null;
  return data as InterpretedGoal;
}
