import { supabase } from '../supabase';
import { CardioSession } from '../engine/cardio-engine';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchCardioSessions(userId: string, sinceDaysAgo: number = 35): Promise<CardioSession[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('id, description, activity_type, duration_min, distance_km, kcal, avg_heart_rate, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', since.toISOString().slice(0, 10))
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export type NewCardioSession = {
  description: string;
  activity_type: string | null;
  duration_min: number | null;
  distance_km: number | null;
  kcal: number;
  avg_heart_rate: number | null;
};

export async function insertCardioSession(userId: string, session: NewCardioSession, date: string = todayKey()) {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .insert({ ...session, user_id: userId, logged_at: date, source: 'chat' })
    .select()
    .single();
  if (error) throw error;
  return data as CardioSession;
}

export async function deleteCardioSession(id: string) {
  const { error } = await supabase.from('cardio_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateCardioSession(session: CardioSession, userId: string, date: string = todayKey()) {
  return insertCardioSession(
    userId,
    {
      description: session.description,
      activity_type: session.activity_type,
      duration_min: session.duration_min,
      distance_km: session.distance_km,
      kcal: session.kcal,
      avg_heart_rate: session.avg_heart_rate,
    },
    date
  );
}

export type CardioTemplate = {
  id: string;
  description: string;
  activity_type: string | null;
  duration_min: number | null;
  distance_km: number | null;
  kcal: number;
  avg_heart_rate: number | null;
};

export async function saveCardioAsTemplate(userId: string, session: CardioSession) {
  const { error } = await supabase.from('cardio_templates').insert({
    user_id: userId,
    description: session.description,
    activity_type: session.activity_type,
    duration_min: session.duration_min,
    distance_km: session.distance_km,
    kcal: session.kcal,
    avg_heart_rate: session.avg_heart_rate,
  });
  if (error) throw error;
}

export async function fetchCardioTemplates(userId: string): Promise<CardioTemplate[]> {
  const { data, error } = await supabase
    .from('cardio_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteCardioTemplate(id: string) {
  const { error } = await supabase.from('cardio_templates').delete().eq('id', id);
  if (error) throw error;
}

// Llama a la Edge Function de Supabase que analiza el texto de cardio con IA.
export async function analyzeCardioText(text: string): Promise<{
  desc: string;
  activity_type: string;
  duration_min: number;
  distance_km: number;
  kcal: number;
  avg_heart_rate: number;
}> {
  const { data, error } = await supabase.functions.invoke('analyze-cardio', { body: { text } });
  if (error) throw error;
  return data;
}
