import {
  Mesocycle,
  MesoDay,
  MesoSession,
  SessionDef,
  ProgressionSuggestion,
  Level,
  Phase,
  MuscleGroup,
} from './types';

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'pecho', label: 'Chest' },
  { id: 'espalda', label: 'Back' },
  { id: 'lumbar', label: 'Lower back' },
  { id: 'core', label: 'Abs / Core' },
  { id: 'hombro', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'cuadriceps', label: 'Quads' },
  { id: 'isquios', label: 'Hamstrings' },
  { id: 'gluteo', label: 'Glutes' },
  { id: 'aductores', label: 'Adductors' },
  { id: 'abductores', label: 'Abductors' },
  { id: 'gemelos', label: 'Calves' },
];

const BIG_GROUPS: MuscleGroup[] = ['pecho', 'espalda', 'cuadriceps', 'isquios', 'gluteo', 'hombro'];

const VOLUME_RANGES: Record<Level, { min: number; max: number }> = {
  principiante: { min: 4, max: 12 },
  avanzado: { min: 8, max: 20 },
};

export function totalSessions(meso: Pick<Mesocycle, 'duration_weeks' | 'days_per_week'>): number {
  return (meso.duration_weeks + 1) * meso.days_per_week;
}

export function getSessionDef(meso: Mesocycle, index: number, overrides?: Record<string, number>): SessionDef {
  const perWeek = meso.days_per_week;
  const week = Math.floor(index / perWeek) + 1;
  const isDeload = week === meso.duration_weeks + 1;
  const dayIndex = index % perWeek;
  const day = meso.days[dayIndex];
  const exercises = day.exercises.map((e) => {
    let sets = isDeload ? Math.max(1, Math.round(e.sets * 0.6)) : e.sets;
    if (overrides && overrides[e.id] != null) sets = overrides[e.id];
    return { id: e.id, name: e.name, sets, reps: e.reps };
  });
  return { week, isDeload, dayIndex, dayLabel: day.label, exercises };
}

// RIR objetivo: interpolación lineal de 3 (semana 1) a 0/fallo (última semana),
// con suelo distinto según nivel (principiante nunca baja de 1).
export function computeWeekRIR(week: number, totalWeeks: number, level: Level): number {
  const floor = level === 'principiante' ? 1 : 0;
  if (totalWeeks <= 1) return Math.max(floor, 2);
  const startRIR = 3;
  const t = (week - 1) / (totalWeeks - 1);
  const rir = Math.round(startRIR * (1 - t));
  return Math.max(floor, rir);
}

function parseRepRange(str: string): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(str || '');
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

function findPrevSessionsData(
  sessions: Record<number, MesoSession>,
  exerciseId: string,
  beforeIndex: number,
  perWeek: number,
  count: number
): { kg: number; reps: number }[][] {
  const results: { kg: number; reps: number }[][] = [];
  for (let i = beforeIndex - perWeek; i >= 0 && results.length < count; i -= perWeek) {
    const sess = sessions[i];
    if (!sess) continue;
    const sets = sess.sets
      .filter((s) => s.exercise_id === exerciseId && s.kg != null)
      .map((s) => ({ kg: s.kg as number, reps: s.reps as number }));
    if (sets.length) results.push(sets);
  }
  return results;
}

export function suggestProgression(
  meso: Mesocycle,
  sessions: Record<number, MesoSession>,
  exerciseId: string,
  reps: string,
  sessionIndex: number,
  isDeload: boolean
): ProgressionSuggestion | null {
  if (isDeload) {
    return { text: 'Deload week: drop weight ~15-20% from your last normal session and raise your RIR.' };
  }
  const level = meso.level;
  const need = level === 'avanzado' ? 2 : 1;
  const history = findPrevSessionsData(sessions, exerciseId, sessionIndex, meso.days_per_week, need);
  if (!history.length) return null;

  const last = history[0];
  const range = parseRepRange(reps);
  const kgs = last.map((s) => s.kg).filter((n) => !isNaN(n));
  const repsArr = last.map((s) => s.reps).filter((n) => !isNaN(n));
  if (!kgs.length) return null;

  const avg = Math.round((kgs.reduce((a, b) => a + b, 0) / kgs.length) * 10) / 10;
  const inc = level === 'principiante' ? (avg >= 40 ? 2.5 : 1.5) : avg >= 40 ? 2.5 : 1.25;
  const repsHit = range ? repsArr.filter((r) => r >= range[1]).length : 0;
  const allTop = !!range && repsArr.length > 0 && repsHit === repsArr.length;
  const mostlyTop = !!range && repsArr.length > 0 && repsHit >= Math.ceil(repsArr.length / 2);
  const belowMin = !!range && repsArr.some((r) => r < range[0]);

  let hitTop = level === 'principiante' ? mostlyTop : allTop;
  if (level === 'avanzado' && hitTop) {
    if (history.length < 2) {
      hitTop = false;
    } else {
      const prevReps = history[1].map((s) => s.reps).filter((n) => !isNaN(n));
      const prevAllTop = !!range && prevReps.length > 0 && prevReps.every((r) => r >= range[1]);
      if (!prevAllTop) hitTop = false;
    }
  }

  const phase = meso.phase;
  if (phase === 'definicion') {
    if (hitTop) return { text: `Keep ~${avg}kg, add 1 rep if you can (cut phase: no rush to add weight)` };
    if (belowMin) return { text: `Drop to ~${avg - inc}kg and prioritize technique` };
    return { text: `Keep ~${avg}kg, aim to complete the rep range` };
  }
  if (phase === 'mantenimiento') {
    if (hitTop) return { text: `Go up to ~${avg + inc}kg` };
    return { text: `Keep ~${avg}kg` };
  }
  // volumen
  if (hitTop) {
    return {
      text: `Go up to ~${avg + inc}kg${level === 'avanzado' ? ' — hit the top of the range 2 sessions in a row' : ' — hit the top of the range last time'}`,
    };
  }
  if (belowMin) return { text: `Same weight (~${avg}kg), prioritize hitting the minimum reps` };
  return { text: `Same weight (~${avg}kg), aim for 1-2 more reps` };
}

function weeklySetsByGroup(days: MesoDay[]): Record<MuscleGroup, number> {
  const sums = {} as Record<MuscleGroup, number>;
  MUSCLE_GROUPS.forEach((g) => (sums[g.id] = 0));
  days.forEach((d) => {
    d.exercises.forEach((e) => {
      const g = e.muscle_group || 'core';
      sums[g] = (sums[g] || 0) + (e.sets || 0);
    });
  });
  return sums;
}

export function analyzeSplit(days: MesoDay[], phase: Phase, level: Level): string[] {
  const sums = weeklySetsByGroup(days);
  const range = VOLUME_RANGES[level] || VOLUME_RANGES.principiante;
  const warns: string[] = [];

  BIG_GROUPS.forEach((gid) => {
    const label = MUSCLE_GROUPS.find((m) => m.id === gid)!.label;
    if (sums[gid] === 0) {
      warns.push(`No ${label} exercise anywhere in this mesocycle.`);
    } else if (sums[gid] < range.min) {
      warns.push(
        `${label}: only ${sums[gid]} sets/week, a bit low (recommended ${range.min}-${range.max} for ${level === 'avanzado' ? 'an advanced level' : 'steady progress'}).`
      );
    } else if (sums[gid] > range.max) {
      warns.push(`${label}: ${sums[gid]} sets/week, might be too much volume (recommended ${range.min}-${range.max}).`);
    }
  });

  if (sums.core === 0) warns.push('No core work — you can add it yourself from the exercise search.');
  if (sums.pecho > 0 && sums.espalda === 0) warns.push('Pushing (chest) but no pulling (back) — risk of shoulder imbalance.');
  if (sums.espalda > 0 && sums.pecho === 0) warns.push('Pulling (back) but no pushing (chest).');

  days.forEach((d) => {
    if (d.exercises.length < 3) warns.push(`"${d.label}" has very few exercises (${d.exercises.length}), 3-6 is recommended.`);
    if (d.exercises.length > 7) warns.push(`"${d.label}" has ${d.exercises.length} exercises, might be too much for one session.`);
  });

  if (phase === 'definicion') {
    const totalSets = Object.values(sums).reduce((a, b) => a + b, 0);
    if (totalSets > range.max * BIG_GROUPS.length * 0.7) {
      warns.push('Fairly high total volume while cutting. In a calorie deficit, more volume is not always better — consider trimming if recovery feels off.');
    }
  }

  if (!warns.length) warns.push('The split looks balanced: good muscle group coverage and reasonable weekly volume.');
  return warns;
}

// PR (Personal Record) — fórmula de Epley para estimar el 1RM
export function estimate1RM(kg: number, reps: number): number {
  return kg * (1 + reps / 30);
}

export function isNewPR(kg: number, reps: number, previousBest: number | null): boolean {
  if (reps <= 0 || kg <= 0) return false;
  const est = estimate1RM(kg, reps);
  return previousBest == null || est > previousBest;
}
