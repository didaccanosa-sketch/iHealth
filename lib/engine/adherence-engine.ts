// Adherence Engine — lógica pura (sin Supabase, sin UI), hermano pequeño del
// Goal Engine para agua/sueño/pasos (ver TODO.md, sección "Tracking de
// agua/sueño/pasos"). A diferencia del Goal Engine, esto no es un objetivo
// que tiende hacia un valor futuro con fecha — es un hábito diario con un
// target fijo cada día. Por eso no calcula tendencia ni fecha proyectada,
// solo "¿cuánto llevas hoy de tu target?" por métrica, capado a [0, 1].
import type { TodayTracking } from '../data/tracking';

export type AdherenceTargets = {
  waterMl: number;
  sleepHours: number;
  steps: number;
};

export type DailyAdherence = {
  water: number; // 0-1
  sleep: number; // 0-1
  steps: number; // 0-1
  overall: number; // media de las tres, 0-1
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeDailyAdherence(today: TodayTracking, targets: AdherenceTargets): DailyAdherence {
  const water = targets.waterMl > 0 ? clamp01(today.waterMl / targets.waterMl) : 0;
  const sleep = targets.sleepHours > 0 ? clamp01((today.sleepHours ?? 0) / targets.sleepHours) : 0;
  const steps = targets.steps > 0 ? clamp01((today.steps ?? 0) / targets.steps) : 0;
  const overall = (water + sleep + steps) / 3;
  return { water, sleep, steps, overall };
}
