// Recovery Engine — lógica pura (sin Supabase, sin UI).
//
// Consume el feedback que ya se guarda por sesión (dificultad, dolor
// articular) más qué grupos musculares entrenó cada sesión, y calcula:
//   1) un estado de recuperación por grupo muscular (uso interno — para el
//      User Model / futuro Recommendation Engine, no se muestra hoy),
//   2) un readiness general único (fresh/moderate/fatigued), que es lo
//      único que se enseña al usuario por ahora (tarjeta provisional en
//      Today).
//
// No decide nada por sí mismo (no cambia el wizard, no sugiere descanso
// automáticamente) — eso es trabajo futuro del Recommendation Engine, este
// motor solo calcula y explica.

import { MuscleGroup } from './types';

export type Difficulty = 'facil' | 'normal' | 'dificil' | 'limite';

export type RecoverySessionInput = {
  completedAt: string; // ISO date (yyyy-mm-dd), más reciente = mayor prioridad
  muscleGroups: MuscleGroup[]; // grupos entrenados en esa sesión
  difficulty: Difficulty;
  jointPain: boolean;
  joint: string | null;
};

export type RecoveryStatus = 'fresh' | 'moderate' | 'fatigued';

export type MuscleRecoveryInfo = {
  status: RecoveryStatus;
  daysSinceTrained: number;
  lastDifficulty: Difficulty;
  jointPainReported: boolean;
};

export type RecoveryEvaluation = {
  readiness: RecoveryStatus;
  message: string;
  byMuscleGroup: Partial<Record<MuscleGroup, MuscleRecoveryInfo>>;
};

// Días de recuperación esperados según la dificultad reportada — cuanto más
// dura la sesión percibida, más tiempo hace falta antes de considerar el
// grupo "fresco" otra vez. Cifras de referencia general, no clínicas; se
// pueden afinar más adelante con más datos reales de usuarios.
const RECOVERY_DAYS: Record<Difficulty, number> = {
  facil: 1,
  normal: 2,
  dificil: 3,
  limite: 4,
};

const SEVERITY: Record<RecoveryStatus, number> = { fresh: 0, moderate: 1, fatigued: 2 };

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function statusFromDays(daysSince: number, recoveryWindow: number): RecoveryStatus {
  if (daysSince >= recoveryWindow) return 'fresh';
  if (daysSince >= recoveryWindow / 2) return 'moderate';
  return 'fatigued';
}

// Punto de entrada principal. Genérico a propósito: no sabe de mesociclos ni
// de Supabase, solo recibe sesiones ya resueltas a "qué grupos musculares +
// qué feedback".
export function evaluateRecovery(sessions: RecoverySessionInput[], today?: string): RecoveryEvaluation {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  // Más reciente primero — así "find" siempre coge la última vez que se
  // entrenó cada grupo.
  const sorted = [...sessions].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));

  const allGroups = new Set<MuscleGroup>();
  sorted.forEach((s) => s.muscleGroups.forEach((g) => allGroups.add(g)));

  const byMuscleGroup: Partial<Record<MuscleGroup, MuscleRecoveryInfo>> = {};
  allGroups.forEach((group) => {
    const last = sorted.find((s) => s.muscleGroups.includes(group));
    if (!last) return;
    const daysSince = Math.max(0, daysBetween(last.completedAt, todayStr));
    const recoveryWindow = RECOVERY_DAYS[last.difficulty] + (last.jointPain ? 1 : 0);
    byMuscleGroup[group] = {
      status: statusFromDays(daysSince, recoveryWindow),
      daysSinceTrained: daysSince,
      lastDifficulty: last.difficulty,
      jointPainReported: last.jointPain,
    };
  });

  const infos = Object.values(byMuscleGroup) as MuscleRecoveryInfo[];
  if (!infos.length) {
    return {
      readiness: 'fresh',
      message: 'No hay sesiones recientes registradas — nada marcado como fatigado.',
      byMuscleGroup,
    };
  }

  const worst = infos.reduce((acc, info) => (SEVERITY[info.status] > SEVERITY[acc.status] ? info : acc));
  const worstGroupName = (Object.entries(byMuscleGroup).find(([, info]) => info === worst) || [null])[0] as
    | MuscleGroup
    | null;

  // Dolor articular en cualquiera de las últimas 3 sesiones registradas —
  // se avisa aparte del readiness numérico, no cambia el status por sí solo
  // salvo que ya esté empujando el recoveryWindow del grupo afectado.
  const jointPainRecent = sorted.slice(0, 3).some((s) => s.jointPain);

  let message: string;
  if (worst.status === 'fatigued') {
    message = worstGroupName
      ? `Todavía recuperándote de ${worstGroupName} — dale margen antes de la próxima sesión intensa.`
      : 'Todavía en fase de recuperación — dale margen antes de la próxima sesión intensa.';
  } else if (worst.status === 'moderate') {
    message = 'Recuperación en curso, pero razonablemente bien para entrenar con normalidad.';
  } else {
    message = 'Fresco — sin fatiga reciente relevante.';
  }
  if (jointPainRecent) {
    message += ' Dolor articular reportado recientemente — vigílalo.';
  }

  return { readiness: worst.status, message, byMuscleGroup };
}
