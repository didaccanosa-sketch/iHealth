import { supabase } from '../supabase';
import { Mesocycle, MesoDay, MesoExercise, MesoSession, Level, Phase, MuscleGroup } from '../engine/types';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type MesoSummary = {
  id: string;
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  current_index: number;
  finished: boolean;
  created_at: string;
  completed_sessions: number;
};

export async function fetchMesocycles(userId: string): Promise<MesoSummary[]> {
  const { data: mesos, error } = await supabase
    .from('mesocycles')
    .select('id, level, phase, duration_weeks, days_per_week, current_index, finished, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!mesos || !mesos.length) return [];

  const { data: sessionCounts, error: err2 } = await supabase
    .from('meso_sessions')
    .select('mesocycle_id')
    .eq('user_id', userId)
    .eq('completed', true);
  if (err2) throw err2;

  const counts = new Map<string, number>();
  (sessionCounts || []).forEach((s: any) => counts.set(s.mesocycle_id, (counts.get(s.mesocycle_id) || 0) + 1));

  return mesos.map((m: any) => ({ ...m, completed_sessions: counts.get(m.id) || 0 }));
}

export async function fetchMesocycleDetail(id: string): Promise<Mesocycle> {
  const { data: meso, error } = await supabase
    .from('mesocycles')
    .select('id, height_cm, level, phase, duration_weeks, days_per_week, current_index, finished')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { data: days, error: errDays } = await supabase
    .from('meso_days')
    .select('id, day_index, label')
    .eq('mesocycle_id', id)
    .order('day_index', { ascending: true });
  if (errDays) throw errDays;

  const { data: exercises, error: errEx } = await supabase
    .from('meso_exercises')
    .select('id, meso_day_id, name, muscle_group, sets, reps, sort_order')
    .in('meso_day_id', (days || []).map((d: any) => d.id))
    .order('sort_order', { ascending: true });
  if (errEx) throw errEx;

  const mesoDays: MesoDay[] = (days || []).map((d: any) => ({
    id: d.id,
    day_index: d.day_index,
    label: d.label,
    exercises: (exercises || [])
      .filter((e: any) => e.meso_day_id === d.id)
      .map((e: any) => ({
        id: e.id,
        name: e.name,
        muscle_group: e.muscle_group as MuscleGroup,
        sets: e.sets,
        reps: e.reps,
        sort_order: e.sort_order,
      })) as MesoExercise[],
  }));

  return { ...meso, days: mesoDays } as Mesocycle;
}

export async function fetchSessions(mesocycleId: string, userId: string): Promise<Record<number, MesoSession>> {
  const { data: sessions, error } = await supabase
    .from('meso_sessions')
    .select('id, session_index, completed')
    .eq('mesocycle_id', mesocycleId)
    .eq('user_id', userId);
  if (error) throw error;
  if (!sessions || !sessions.length) return {};

  const { data: sets, error: errSets } = await supabase
    .from('meso_session_sets')
    .select('session_id, exercise_id, set_index, kg, reps, is_pr')
    .in('session_id', sessions.map((s: any) => s.id));
  if (errSets) throw errSets;

  const result: Record<number, MesoSession> = {};
  sessions.forEach((s: any) => {
    result[s.session_index] = {
      id: s.id,
      mesocycle_id: mesocycleId,
      session_index: s.session_index,
      completed: s.completed,
      sets: (sets || [])
        .filter((set: any) => set.session_id === s.id)
        .map((set: any) => ({
          exercise_id: set.exercise_id,
          set_index: set.set_index,
          kg: set.kg,
          reps: set.reps,
          is_pr: set.is_pr,
        })),
    };
  });
  return result;
}

export type NewMesoInput = {
  height_cm: number | null;
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  days: { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] }[];
};

export async function createMesocycle(userId: string, input: NewMesoInput): Promise<string> {
  const { data: meso, error } = await supabase
    .from('mesocycles')
    .insert({
      user_id: userId,
      height_cm: input.height_cm,
      level: input.level,
      phase: input.phase,
      duration_weeks: input.duration_weeks,
      days_per_week: input.days_per_week,
    })
    .select('id')
    .single();
  if (error) throw error;
  const mesoId = meso.id as string;

  for (let i = 0; i < input.days.length; i++) {
    const day = input.days[i];
    const { data: dayRow, error: errDay } = await supabase
      .from('meso_days')
      .insert({ mesocycle_id: mesoId, user_id: userId, day_index: i, label: day.label })
      .select('id')
      .single();
    if (errDay) throw errDay;

    if (day.exercises.length) {
      const rows = day.exercises.map((e, sortOrder) => ({
        meso_day_id: dayRow.id,
        user_id: userId,
        name: e.name,
        muscle_group: e.muscle_group,
        sets: e.sets,
        reps: e.reps,
        sort_order: sortOrder,
      }));
      const { error: errExInsert } = await supabase.from('meso_exercises').insert(rows);
      if (errExInsert) throw errExInsert;
    }
  }

  return mesoId;
}

export async function duplicateMesocycle(baseId: string, userId: string): Promise<NewMesoInput> {
  const detail = await fetchMesocycleDetail(baseId);
  return {
    height_cm: detail.height_cm,
    level: detail.level,
    phase: detail.phase,
    duration_weeks: detail.duration_weeks,
    days_per_week: detail.days_per_week,
    days: detail.days.map((d) => ({
      label: d.label,
      exercises: d.exercises.map((e) => ({ name: e.name, muscle_group: e.muscle_group, sets: e.sets, reps: e.reps })),
    })),
  };
}

async function ensureSessionRow(mesocycleId: string, userId: string, sessionIndex: number): Promise<string> {
  const { data: existing, error: errFind } = await supabase
    .from('meso_sessions')
    .select('id')
    .eq('mesocycle_id', mesocycleId)
    .eq('session_index', sessionIndex)
    .maybeSingle();
  if (errFind) throw errFind;
  if (existing) return existing.id as string;

  const { data: inserted, error: errInsert } = await supabase
    .from('meso_sessions')
    .insert({ mesocycle_id: mesocycleId, user_id: userId, session_index: sessionIndex })
    .select('id')
    .single();
  if (errInsert) throw errInsert;
  return inserted.id as string;
}

export async function saveSet(
  mesocycleId: string,
  userId: string,
  sessionIndex: number,
  exerciseId: string,
  setIndex: number,
  patch: { kg?: number | null; reps?: number | null; is_pr?: boolean }
) {
  const sessionId = await ensureSessionRow(mesocycleId, userId, sessionIndex);
  const { error } = await supabase.from('meso_session_sets').upsert(
    {
      session_id: sessionId,
      exercise_id: exerciseId,
      user_id: userId,
      set_index: setIndex,
      ...patch,
    },
    { onConflict: 'session_id,exercise_id,set_index' }
  );
  if (error) throw error;
}

export async function checkAndRecordPR(
  userId: string,
  exerciseName: string,
  kg: number,
  reps: number,
  est1rm: number
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('personal_records')
    .select('est_1rm')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .maybeSingle();

  if (existing && existing.est_1rm >= est1rm) return false;

  const { error } = await supabase.from('personal_records').upsert(
    {
      user_id: userId,
      exercise_name: exerciseName,
      est_1rm: est1rm,
      kg,
      reps,
      achieved_at: todayKey(),
    },
    { onConflict: 'user_id,exercise_name' }
  );
  if (error) throw error;
  return true;
}

export async function completeSession(
  mesocycleId: string,
  userId: string,
  sessionIndex: number,
  feedback: {
    difficulty: 'facil' | 'normal' | 'dificil' | 'limite';
    joint_pain: boolean;
    joint: string | null;
    sore_exercise: string | null;
    note: string | null;
  }
) {
  const sessionId = await ensureSessionRow(mesocycleId, userId, sessionIndex);
  const { error } = await supabase
    .from('meso_sessions')
    .update({
      completed: true,
      completed_at: todayKey(),
      difficulty: feedback.difficulty,
      joint_pain: feedback.joint_pain,
      joint: feedback.joint,
      sore_exercise: feedback.sore_exercise,
      note: feedback.note,
    })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function advanceMesocycle(mesocycleId: string, newCurrentIndex: number, finished: boolean) {
  const { error } = await supabase.from('mesocycles').update({ current_index: newCurrentIndex, finished }).eq('id', mesocycleId);
  if (error) throw error;
}

export async function endMesocycleEarly(mesocycleId: string) {
  const { error } = await supabase.from('mesocycles').update({ finished: true }).eq('id', mesocycleId);
  if (error) throw error;
}
