// Supabase reads/writes para `weight_logs` — sin lógica de negocio aquí, eso
// vive en lib/engine/goal-engine.ts.
import { supabase } from '../supabase';
import { MetricPoint } from '../engine/goal-engine';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Si ya hay un peso guardado para ese día, lo sustituye en vez de crear
// otro — solo puede haber un peso por día (ver restricción única en
// schema.sql).
export async function logWeight(userId: string, kg: number, loggedAt?: string): Promise<void> {
  const { error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: userId, kg, logged_at: loggedAt ?? todayKey() }, { onConflict: 'user_id,logged_at' });
  if (error) throw error;
}

// Devuelve el histórico como puntos genéricos, ya en la forma que espera el
// Goal Engine (MetricPoint), ordenados por fecha ascendente.
export async function fetchWeightHistory(userId: string): Promise<MetricPoint[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('kg, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({ date: row.logged_at as string, value: row.kg as number }));
}

export async function deleteWeightLog(id: string): Promise<void> {
  const { error } = await supabase.from('weight_logs').delete().eq('id', id);
  if (error) throw error;
}
