// Supabase reads para el histórico de fuerza (1RM estimado por ejercicio) —
// sin lógica de negocio aquí, eso vive en lib/engine (estimate1RM y
// goal-engine). Se hacen varias consultas simples y se unen en JS, mismo
// patrón que fetchMesocycles en lib/data/workout.ts, en vez de un join
// anidado de PostgREST — más fácil de leer y de depurar.
import { supabase } from '../supabase';
import { estimate1RM } from '../engine/workout-engine';
import { MetricPoint } from '../engine/goal-engine';

// Nombres de ejercicio que el usuario ya ha registrado alguna vez — para que
// la UI pueda ofrecerlos como sugerencia en vez de depender de texto libre
// exacto.
export async function fetchLoggedExerciseNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('meso_exercises').select('name').eq('user_id', userId);
  if (error) throw error;
  const names = new Set((data || []).map((r: any) => r.name as string));
  return Array.from(names).sort();
}

// Histórico de 1RM estimado para un ejercicio: un punto por sesión
// completada, con el mejor 1RM estimado entre las series registradas ese
// día. Coincidencia de nombre exacta (sin distinguir mayúsculas) — si el
// usuario lo escribió distinto entre mesociclos, no se agrupará.
export async function fetchStrengthHistory(userId: string, exerciseName: string): Promise<MetricPoint[]> {
  const { data: exercises, error: exErr } = await supabase
    .from('meso_exercises')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', exerciseName);
  if (exErr) throw exErr;
  const exerciseIds = (exercises || []).map((e: any) => e.id as string);
  if (!exerciseIds.length) return [];

  const { data: sets, error: setsErr } = await supabase
    .from('meso_session_sets')
    .select('session_id, kg, reps')
    .eq('user_id', userId)
    .in('exercise_id', exerciseIds)
    .not('kg', 'is', null)
    .not('reps', 'is', null);
  if (setsErr) throw setsErr;
  if (!sets || !sets.length) return [];

  const sessionIds = Array.from(new Set(sets.map((s: any) => s.session_id as string)));
  const { data: sessions, error: sessErr } = await supabase
    .from('meso_sessions')
    .select('id, completed_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .in('id', sessionIds);
  if (sessErr) throw sessErr;

  const dateBySession = new Map<string, string>();
  (sessions || []).forEach((s: any) => {
    if (s.completed_at) dateBySession.set(s.id, s.completed_at as string);
  });

  const best1RMBySession = new Map<string, number>();
  sets.forEach((s: any) => {
    const date = dateBySession.get(s.session_id);
    if (!date) return; // sesión no completada, no cuenta para el histórico
    const est = estimate1RM(s.kg, s.reps);
    const current = best1RMBySession.get(s.session_id) ?? 0;
    if (est > current) best1RMBySession.set(s.session_id, est);
  });

  // Un punto por fecha (si hubiera dos sesiones el mismo día, nos quedamos
  // con el mejor 1RM de ese día).
  const bestByDate = new Map<string, number>();
  best1RMBySession.forEach((est, sessionId) => {
    const date = dateBySession.get(sessionId)!;
    const current = bestByDate.get(date) ?? 0;
    if (est > current) bestByDate.set(date, est);
  });

  return Array.from(bestByDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
