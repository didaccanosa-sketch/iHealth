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
  const maxRepsAchieved = repsArr.length ? Math.max(...repsArr) : range ? range[0] : 0;
  const targetReps = range ? Math.min(range[1], maxRepsAchieved + 1) : maxRepsAchieved + 1;

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
    if (hitTop) return { text: `Keep ~${avg}kg, aim for ${targetReps} reps (cut phase: no rush to add weight)` };
    if (belowMin) return { text: `Drop to ~${avg - inc}kg and prioritize technique` };
    return { text: `Keep ~${avg}kg, aim for ${targetReps} reps` };
  }
  if (phase === 'mantenimiento') {
    if (hitTop) return { text: `Go up to ~${avg + inc}kg` };
    return { text: `Keep ~${avg}kg, aim for ${targetReps} reps` };
  }
  // volumen
  if (hitTop) {
    return {
      text: `Go up to ~${avg + inc}kg${level === 'avanzado' ? ' — hit the top of the range 2 sessions in a row' : ' — hit the top of the range last time'}`,
    };
  }
  if (belowMin) return { text: `Same weight (~${avg}kg), aim for at least ${range ? range[0] : targetReps} reps` };
  return { text: `Same weight (~${avg}kg), aim for ${targetReps} reps` };
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

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function analyzeSplit(days: MesoDay[], phase: Phase, level: Level): string {
  const sums = weeklySetsByGroup(days);
  const range = VOLUME_RANGES[level] || VOLUME_RANGES.principiante;

  const missingGroups: string[] = [];
  const lowGroups: string[] = [];
  const highGroups: string[] = [];

  BIG_GROUPS.forEach((gid) => {
    const label = MUSCLE_GROUPS.find((m) => m.id === gid)!.label;
    if (sums[gid] === 0) missingGroups.push(label);
    else if (sums[gid] < range.min) lowGroups.push(label);
    else if (sums[gid] > range.max) highGroups.push(label);
  });

  const dayIssues = days.filter((d) => d.exercises.length < 3 || d.exercises.length > 7);
  const pushNoPull = sums.pecho > 0 && sums.espalda === 0;
  const pullNoPush = sums.espalda > 0 && sums.pecho === 0;
  const totalSets = Object.values(sums).reduce((a, b) => a + b, 0);
  const highVolumeInCut = phase === 'definicion' && totalSets > range.max * BIG_GROUPS.length * 0.7;

  const hasIssues =
    missingGroups.length || lowGroups.length || highGroups.length || dayIssues.length || pushNoPull || pullNoPush || sums.core === 0 || highVolumeInCut;

  const parts: string[] = [];

  parts.push(
    hasIssues
      ? "Here's how this split looks."
      : 'This split looks solid — good coverage across muscle groups and a sensible amount of weekly volume.'
  );

  if (missingGroups.length) {
    parts.push(
      `You don't have any ${joinList(missingGroups)} work anywhere in the mesocycle, which is worth fixing before you get going.`
    );
  }
  if (lowGroups.length) {
    parts.push(
      `${joinList(lowGroups)} ${lowGroups.length > 1 ? 'look' : 'looks'} a bit light — under the ${range.min}-${range.max} sets/week that tends to work well ${level === 'avanzado' ? 'at an advanced level' : 'for steady progress'}, so ${lowGroups.length > 1 ? 'those' : 'that'} might lag behind the rest.`
    );
  }
  if (highGroups.length) {
    parts.push(
      `${joinList(highGroups)} ${highGroups.length > 1 ? 'are' : 'is'} on the high side, above ${range.max} sets/week — not a problem on its own, just keep an eye on how you're recovering.`
    );
  }
  if (pushNoPull) parts.push("There's pushing work (chest) in here but nothing pulling (back), which can throw your shoulders out of balance over time.");
  if (pullNoPush) parts.push("You've got pulling work (back) but no pushing (chest) — worth adding some for balance.");
  if (sums.core === 0) parts.push("There's no core work either, though you can always add some later from the exercise search.");
  if (dayIssues.length) {
    dayIssues.forEach((d) => {
      parts.push(
        d.exercises.length < 3
          ? `"${d.label}" only has ${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'} — usually 3-6 makes for a fuller session.`
          : `"${d.label}" has ${d.exercises.length} exercises, which might be a lot to get through in one sitting.`
      );
    });
  }
  if (highVolumeInCut) {
    parts.push("You're also cutting with fairly high total volume — in a calorie deficit, more isn't always better, so trim it back if recovery starts to suffer.");
  }
  if (hasIssues) parts.push("None of this is a dealbreaker — you can always tweak sets and exercises later.");

  return parts.join(' ');
}

// Feedback explicativo para splits que salen del generador de énfasis (Focused split):
// por qué un grupo priorizado aparece más de una vez y con qué se emparejó, más una
// nota proactiva de recuperación — a diferencia de analyzeSplit, que solo avisa cuando
// falta algo.
export function explainFocusChoices(days: MesoDay[], priority: MuscleGroup[]): string {
  if (!priority.length) return '';
  const label = (g: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === g)?.label || g;

  const parts: string[] = [];
  priority.forEach((g) => {
    const dayIdxs = days.map((d, i) => (d.exercises.some((e) => e.muscle_group === g) ? i : -1)).filter((i) => i !== -1);
    if (!dayIdxs.length) return;

    const freq = dayIdxs.length;
    const intro = `You gave priority to ${label(g)}, so it shows up ${freq} time${freq === 1 ? '' : 's'} this week`;

    const pairings = dayIdxs
      .map((i) => {
        const others = Array.from(new Set(days[i].exercises.map((e) => e.muscle_group))).filter((m) => m !== g);
        return others.length ? `${days[i].label} alongside ${others.map(label).join(', ')}` : null;
      })
      .filter((s): s is string => !!s);

    parts.push(pairings.length ? `${intro} — paired with ${pairings.join('; ')} to spread the rest of the volume out.` : `${intro}.`);
  });

  if (!parts.length) return '';
  parts.push('Sets already ease off automatically in the deload week at the end, so recovery is built in — no need to plan around it.');
  return parts.join(' ');
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
