// Supabase reads/writes para agua/sueño/pasos — sin lógica de negocio aquí,
// mismo patrón que weight-logs.ts. Agua es la suma de varias filas del día
// (cada toque de "+vaso" es un insert nuevo); sueño y pasos son un valor
// único por día (upsert, igual que el peso).
import { supabase } from '../supabase';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type TodayTracking = {
  waterMl: number;
  sleepHours: number | null;
  steps: number | null;
};

// Agua: un insert por toque, nunca se sobrescribe — el total del día es la
// suma de todas las filas de ese `logged_at`.
export async function addWater(userId: string, ml: number, loggedAt?: string): Promise<void> {
  const { error } = await supabase
    .from('water_logs')
    .insert({ user_id: userId, ml, logged_at: loggedAt ?? todayKey() });
  if (error) throw error;
}

export async function logSleep(userId: string, hours: number, loggedAt?: string): Promise<void> {
  const { error } = await supabase
    .from('sleep_logs')
    .upsert({ user_id: userId, hours, logged_at: loggedAt ?? todayKey() }, { onConflict: 'user_id,logged_at' });
  if (error) throw error;
}

export async function logSteps(userId: string, steps: number, loggedAt?: string): Promise<void> {
  const { error } = await supabase
    .from('step_logs')
    .upsert({ user_id: userId, steps, logged_at: loggedAt ?? todayKey() }, { onConflict: 'user_id,logged_at' });
  if (error) throw error;
}

// Los tres valores de hoy juntos — pensado para el widget de Today, una sola
// llamada en vez de tres.
export async function fetchTodayTracking(userId: string): Promise<TodayTracking> {
  const today = todayKey();
  const [waterRes, sleepRes, stepsRes] = await Promise.all([
    supabase.from('water_logs').select('ml').eq('user_id', userId).eq('logged_at', today),
    supabase.from('sleep_logs').select('hours').eq('user_id', userId).eq('logged_at', today).maybeSingle(),
    supabase.from('step_logs').select('steps').eq('user_id', userId).eq('logged_at', today).maybeSingle(),
  ]);
  if (waterRes.error) throw waterRes.error;
  if (sleepRes.error) throw sleepRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const waterMl = (waterRes.data || []).reduce((sum: number, row: any) => sum + Number(row.ml), 0);
  return {
    waterMl,
    sleepHours: sleepRes.data ? Number(sleepRes.data.hours) : null,
    steps: stepsRes.data ? Number(stepsRes.data.steps) : null,
  };
}
