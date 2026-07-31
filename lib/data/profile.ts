import { supabase } from '../supabase';

export async function fetchPreferredTrainingDays(userId: string): Promise<number | null> {
  const { data, error } = await supabase.from('profiles').select('preferred_training_days').eq('id', userId).single();
  if (error) throw error;
  return data?.preferred_training_days ?? null;
}

export async function savePreferredTrainingDays(userId: string, days: number) {
  const { error } = await supabase.from('profiles').update({ preferred_training_days: days }).eq('id', userId);
  if (error) throw error;
}

export type ProfileInfo = {
  name: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
};

export async function fetchProfile(userId: string): Promise<ProfileInfo> {
  const { data, error } = await supabase.from('profiles').select('name, height_cm, starting_weight_kg').eq('id', userId).single();
  if (error) throw error;
  return data as ProfileInfo;
}
