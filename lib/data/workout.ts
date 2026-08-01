import { supabase } from '../supabase';
import { Mesocycle, MesoDay, MesoExercise, MesoSession, Level, Phase, MuscleGroup } from '../engine/types';
import { RecoverySessionInput } from '../engine/recovery-engine';

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
  started: boolean;
  finished: boolean;
  created_at: string;
  completed_sessions: number;
};

export async function fetchMesocycles(userId: string): Promise<MesoSummary[]> {
  const { data: mesos, error } = await supabase
    .from('mesocycles')
    .select('id, level, phase, duration_weeks, days_per_week, current_index, started, finished, created_at')
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
    .select('id, height_cm, level, phase, duration_weeks, days_per_week, current_index, started, finished')
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

// Para el Recovery Engine (lib/engine/recovery-engine.ts): trae las sesiones
// completadas recientes de un usuario (across todos sus mesociclos, no solo
// el activo) junto con qué grupos musculares entrenó cada una. El feedback
// de sesión (difficulty/joint_pain/joint) ya se guardaba desde antes en
// `meso_sessions`, pero nada lo leía todavía — esto es lo que lo conecta.
export async function fetchRecentSessionFeedback(userId: string, sinceDaysAgo = 14): Promise<RecoverySessionInput[]> {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: sessions, error } = await supabase
    .from('meso_sessions')
    .select('mesocycle_id, session_index, completed_at, difficulty, joint_pain, joint')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('completed_at', cutoff);
  if (error) throw error;
  if (!sessions || !sessions.length) return [];

  const mesoIds = [...new Set(sessions.map((s: any) => s.mesocycle_id))];

  const { data: mesos, error: errMesos } = await supabase
    .from('mesocycles')
    .select('id, days_per_week')
    .in('id', mesoIds);
  if (errMesos) throw errMesos;

  const { data: days, error: errDays } = await supabase
    .from('meso_days')
    .select('id, mesocycle_id, day_index')
    .in('mesocycle_id', mesoIds);
  if (errDays) throw errDays;

  const { data: exercises, error: errEx } = await supabase
    .from('meso_exercises')
    .select('meso_day_id, muscle_group')
    .in('meso_day_id', (days || []).map((d: any) => d.id));
  if (errEx) throw errEx;

  const perWeekByMeso = new Map<string, number>((mesos || []).map((m: any) => [m.id, m.days_per_week]));

  // Grupos musculares por (mesociclo, day_index) — el day_index de
  // meso_days es el día dentro de la semana, igual que en getSessionDef.
  const muscleGroupsByDay = new Map<string, MuscleGroup[]>();
  (days || []).forEach((d: any) => {
    const key = `${d.mesocycle_id}:${d.day_index}`;
    const groups = (exercises || [])
      .filter((e: any) => e.meso_day_id === d.id)
      .map((e: any) => e.muscle_group as MuscleGroup);
    muscleGroupsByDay.set(key, groups);
  });

  return sessions
    .map((s: any) => {
      const perWeek = perWeekByMeso.get(s.mesocycle_id) || 1;
      const dayIndex = s.session_index % perWeek;
      const muscleGroups = muscleGroupsByDay.get(`${s.mesocycle_id}:${dayIndex}`) || [];
      return {
        completedAt: s.completed_at,
        muscleGroups,
        difficulty: s.difficulty,
        jointPain: s.joint_pain,
        joint: s.joint,
      } as RecoverySessionInput;
    })
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
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
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  days: { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] }[];
  // Metadata de origen, solo para enriquecer el feedback del wizard — nunca se persiste en `mesocycles`.
  generatedFrom?: 'focus' | 'recommendation';
  focusPriority?: MuscleGroup[];
  recommendationExplanations?: string[]; // texto plano del Strategy Planner, ver docs/RECOMMENDATION_ENGINE.md
};

export async function createMesocycle(userId: string, input: NewMesoInput): Promise<string> {
  // Cada mesociclo se crea envuelto en su propio programa (1:1 por ahora) —
  // ver comentario en schema.sql sobre `training_programs`.
  const { data: program, error: errProgram } = await supabase
    .from('training_programs')
    .insert({ user_id: userId, status: 'draft' })
    .select('id')
    .single();
  if (errProgram) throw errProgram;

  const { data: meso, error } = await supabase
    .from('mesocycles')
    .insert({
      user_id: userId,
      program_id: program.id,
      level: input.level,
      phase: input.phase,
      duration_weeks: input.duration_weeks,
      days_per_week: input.days_per_week,
      started: false,
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

// Marca el meso como "empezado" — solo si no hay otro programa ya activo para
// este usuario. La exclusividad vive en `training_programs.status`, no en
// `mesocycles.started`; se mantiene también el chequeo antiguo por si algún
// mesociclo se creó antes de que existiera `program_id` (sin programa que lo
// envuelva todavía).
export async function startMesocycle(mesocycleId: string, userId: string) {
  const { data: mesoRow, error: errMeso } = await supabase
    .from('mesocycles')
    .select('program_id')
    .eq('id', mesocycleId)
    .single();
  if (errMeso) throw errMeso;
  const programId = mesoRow?.program_id as string | null;

  const { data: activeMesos, error: errCheckMeso } = await supabase
    .from('mesocycles')
    .select('id')
    .eq('user_id', userId)
    .eq('started', true)
    .eq('finished', false)
    .neq('id', mesocycleId);
  if (errCheckMeso) throw errCheckMeso;

  let activePrograms: { id: string }[] | null = null;
  if (programId) {
    const { data, error: errCheckProgram } = await supabase
      .from('training_programs')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('id', programId);
    if (errCheckProgram) throw errCheckProgram;
    activePrograms = data;
  }

  if ((activeMesos && activeMesos.length) || (activePrograms && activePrograms.length)) {
    throw new Error('You already have a mesocycle in progress. Finish or end it before starting a new one.');
  }

  const { error } = await supabase.from('mesocycles').update({ started: true }).eq('id', mesocycleId);
  if (error) throw error;
  if (programId) {
    const { error: errProgram } = await supabase.from('training_programs').update({ status: 'active' }).eq('id', programId);
    if (errProgram) throw errProgram;
  }
}

// Best-effort: si el mesociclo tiene programa, refleja el estado "finished" en él también —
// libera el hueco de exclusividad (`status = 'active'`) para poder empezar otro.
async function finishProgramForMesocycle(mesocycleId: string) {
  const { data: mesoRow } = await supabase.from('mesocycles').select('program_id').eq('id', mesocycleId).single();
  if (!mesoRow?.program_id) return;
  const { error } = await supabase.from('training_programs').update({ status: 'finished' }).eq('id', mesoRow.program_id);
  if (error) throw error;
}

export async function duplicateMesocycle(baseId: string, userId: string): Promise<NewMesoInput> {
  const detail = await fetchMesocycleDetail(baseId);
  return {
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

export async function ensureSessionRow(mesocycleId: string, userId: string, sessionIndex: number): Promise<string> {
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
  if (finished) await finishProgramForMesocycle(mesocycleId);
}

export async function endMesocycleEarly(mesocycleId: string) {
  const { error } = await supabase.from('mesocycles').update({ finished: true }).eq('id', mesocycleId);
  if (error) throw error;
  await finishProgramForMesocycle(mesocycleId);
}

// Si el mesociclo tiene programa, se borra el programa (cascada a mesociclo +
// días/ejercicios/sesiones vía `on delete cascade`) — así no queda un
// programa huérfano. Los mesociclos creados antes de `program_id` siguen
// borrándose directamente, como antes.
export async function deleteMesocycle(mesocycleId: string, userId: string) {
  const { data: mesoRow } = await supabase
    .from('mesocycles')
    .select('program_id')
    .eq('id', mesocycleId)
    .eq('user_id', userId)
    .single();

  if (mesoRow?.program_id) {
    const { error } = await supabase.from('training_programs').delete().eq('id', mesoRow.program_id).eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('mesocycles').delete().eq('id', mesocycleId).eq('user_id', userId);
  if (error) throw error;
}

// Cambiar el número de series solo para esta sesión concreta (no afecta a otras semanas)
export async function setSessionOverride(mesocycleId: string, userId: string, sessionIndex: number, exerciseId: string, sets: number) {
  const sessionId = await ensureSessionRow(mesocycleId, userId, sessionIndex);
  const { error } = await supabase
    .from('meso_session_overrides')
    .upsert({ session_id: sessionId, exercise_id: exerciseId, user_id: userId, sets }, { onConflict: 'session_id,exercise_id' });
  if (error) throw error;
}

// Cambiar el número de series en la plantilla del ejercicio (afecta a todas las semanas del meso)
export async function updateExerciseSetsGlobal(exerciseId: string, userId: string, sets: number) {
  const { error } = await supabase.from('meso_exercises').update({ sets }).eq('id', exerciseId).eq('user_id', userId);
  if (error) throw error;
}

// Todos los overrides de un mesociclo, indexados por número de sesión y luego por ejercicio
export async function fetchSessionOverrides(mesocycleId: string, userId: string): Promise<Record<number, Record<string, number>>> {
  const { data: sessionRows, error: err1 } = await supabase
    .from('meso_sessions')
    .select('id, session_index')
    .eq('mesocycle_id', mesocycleId)
    .eq('user_id', userId);
  if (err1) throw err1;
  if (!sessionRows || !sessionRows.length) return {};

  const idToIndex = new Map(sessionRows.map((s: any) => [s.id, s.session_index]));
  const { data: overrides, error: err2 } = await supabase
    .from('meso_session_overrides')
    .select('session_id, exercise_id, sets')
    .in(
      'session_id',
      sessionRows.map((s: any) => s.id)
    );
  if (err2) throw err2;

  const result: Record<number, Record<string, number>> = {};
  (overrides || []).forEach((o: any) => {
    const idx = idToIndex.get(o.session_id);
    if (idx == null) return;
    if (!result[idx]) result[idx] = {};
    result[idx][o.exercise_id] = o.sets;
  });
  return result;
}

// ─── Plantillas de mesociclo guardadas por el usuario ───────────────────────
export type UserMesoTemplate = {
  id: string;
  name: string;
  days_per_week: number;
  days: { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] }[];
};

export async function saveMesoAsTemplate(mesocycleId: string, userId: string, name: string) {
  const detail = await fetchMesocycleDetail(mesocycleId);
  const days = detail.days.map((d) => ({
    label: d.label,
    exercises: d.exercises.map((e) => ({ name: e.name, muscle_group: e.muscle_group, sets: e.sets, reps: e.reps })),
  }));
  const { error } = await supabase.from('mesocycle_templates').insert({
    user_id: userId,
    name,
    days_per_week: detail.days_per_week,
    days,
  });
  if (error) throw error;
}

export async function fetchUserMesoTemplates(userId: string): Promise<UserMesoTemplate[]> {
  const { data, error } = await supabase
    .from('mesocycle_templates')
    .select('id, name, days_per_week, days')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as UserMesoTemplate[];
}

export async function deleteUserMesoTemplate(id: string) {
  const { error } = await supabase.from('mesocycle_templates').delete().eq('id', id);
  if (error) throw error;
}
