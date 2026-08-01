// Recommendation Engine — Strategy Planner (paso 1 del orden de construcción,
// ver TODO.md). Pieza pura (sin Supabase, sin React Native, sin IA): decide
// el "qué" (targets) a partir del objetivo + contexto del usuario. Los
// motores de dominio (Workout/Nutrition/Recovery) siguen decidiendo el
// "cómo" — este motor no genera un mesociclo ni un plan de comidas, solo
// los números que esos motores deben ejecutar. Diseño completo en
// docs/RECOMMENDATION_ENGINE.md.
//
// Deliberadamente fuera de esta pasada: prioridad de volumen por grupo
// muscular (queda vacía, no hay con qué decidirla todavía sin inventar
// precisión que no existe) y cualquier ajuste según cómo le está yendo al
// usuario (eso es Adaptación dinámica, paso 8 del orden de construcción).

import { ActivityLevel, Experience, GoalType, Sex } from '../../features/profile/engine/types';
import { GoalEvaluation, suggestPhaseForGoal } from './goal-engine';
import { RecoveryEvaluation, RecoveryStatus } from './recovery-engine';
import { Level, MacroGoals, Phase } from './types';

// ─── INPUT ────────────────────────────────────────────────────────────────
// Contexto ya "desenvuelto" (no el UserModelData completo con sus Fields) —
// desenvolverlo es trabajo del paso 4 (Delegación), no de este motor.

export type StrategyPlannerContext = {
  goal: {
    type: GoalType;
    evaluation: GoalEvaluation | null; // null si aún no se ha evaluado nada
  };
  identity: {
    ageYears: number | null;
    sex: Sex | null;
    heightCm: number | null;
    currentWeightKg: number | null; // último peso conocido
  };
  training: {
    experience: Experience | null;
    trainingMonths: number | null;
    daysPerWeekPreferred: number | null; // preferencia real del usuario, se respeta si existe
    sessionLengthMin: number | null;
  };
  nutrition: {
    mealsPerDayPreferred: number | null;
  };
  lifestyle: {
    dailyActivity: ActivityLevel | null;
  };
  recovery: RecoveryEvaluation | null;
};

// ─── OUTPUT ───────────────────────────────────────────────────────────────

export type StrategyPlan = {
  confidence: 'measured' | 'generic'; // mismo criterio que GoalEvaluation.confidence
  nutrition: MacroGoals & { mealsPerDay: number };
  training: {
    daysPerWeek: number;
    phase: Phase | null; // null solo si el objetivo no tiene fase asociada (ej. strength)
    level: Level; // de la experiencia del usuario; 'principiante' si no se sabe (mismo default que profiles.level)
  };
  cardio: {
    sessionsPerWeek: number;
  };
  recovery: {
    sleepHoursTarget: number; // genérico fijo por ahora, ver docs/RECOMMENDATION_ENGINE.md
  };
  steps: {
    dailyStepsTarget: number; // genérico fijo por ahora
  };
  water: {
    dailyMlTarget: number; // genérico fijo por ahora, mismo criterio que sueño/pasos
  };
  // Hechos en español sencillo (sin jerga), separados por dominio — cada
  // pantalla enseña solo lo suyo (Nutrition no ve por qué se ajustó el
  // cardio, Workout no ve por qué se ajustaron las calorías). No es
  // redacción de IA, es el respaldo instantáneo/fallback — ver
  // docs/RECOMMENDATION_ENGINE.md, capa de IA.
  explanations: {
    nutrition: string[];
    training: string[];
  };
};

// ─── CONSTANTES (todas documentadas, ninguna mágica sin explicar) ─────────

// Multiplicador de actividad sobre el BMR (Mifflin-St Jeor), simplificado a
// los 3 niveles que ya existen en el User Model (LifestyleModel.dailyActivity).
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  low: 1.2,
  medium: 1.55,
  high: 1.725,
};

// Ajuste de kcal sobre el TDEE según objetivo. Déficit/superávit moderados,
// no agresivos — mismo espíritu conservador que el resto del motor.
const KCAL_ADJUSTMENT: Record<GoalType, number> = {
  lose_fat: -500,
  gain_muscle: 300,
  strength: 150,
  maintain: 0,
  stamina: 0,
  mobility: 0,
};

// g de proteína por kg de peso corporal, según objetivo.
const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose_fat: 2.2, // más alto en déficit, para proteger masa muscular
  gain_muscle: 2.0,
  strength: 2.0,
  maintain: 1.8,
  stamina: 1.6,
  mobility: 1.6,
};

// Días de entreno por defecto cuando el usuario no tiene preferencia fijada.
const DEFAULT_DAYS_PER_WEEK: Record<GoalType, number> = {
  lose_fat: 4,
  gain_muscle: 4,
  strength: 4,
  maintain: 3,
  stamina: 3,
  mobility: 2,
};

// Sesiones de cardio/semana — límite inferior del rango ya documentado en
// TODO.md (conservador a propósito, banda de duración genérica 20-40 min).
const DEFAULT_CARDIO_SESSIONS: Record<GoalType, number> = {
  lose_fat: 3,
  stamina: 3,
  maintain: 2,
  gain_muscle: 1,
  strength: 0,
  mobility: 0,
};

// Exportadas (no solo internas) porque el widget de tracking de Today las
// necesita sin depender de tener un objetivo fijado — a diferencia del resto
// del Strategy Planner, estos tres targets no dependen todavía del contexto
// del usuario (ver StrategyPlan.recovery/steps/water).
export const GENERIC_SLEEP_HOURS_TARGET = 8;
export const GENERIC_DAILY_STEPS_TARGET = 8000;
export const GENERIC_DAILY_WATER_ML_TARGET = 2500;
const DEFAULT_MEALS_PER_DAY = 4;

// Mismo binario que ya usa el resto de la app (Experience del User Model).
const EXPERIENCE_TO_LEVEL: Record<Experience, Level> = {
  beginner: 'principiante',
  advanced: 'avanzado',
};

// ─── VALIDATION — límites de seguridad/coherencia, ver paso 2 del orden de
// construcción en TODO.md ──────────────────────────────────────────────────

const MIN_SAFE_KCAL = 1200; // suelo absoluto, nunca por debajo aunque el cálculo diera menos
const MIN_SAFE_KCAL_HIGH_FREQUENCY = 1500; // suelo más alto si hay mucha carga de entreno
const HIGH_FREQUENCY_DAYS_PER_WEEK = 5; // a partir de aquí se considera "mucho entreno"
const MAX_DAYS_PER_WEEK_NEW_BEGINNER = 4; // principiante con pocos meses, tope de días/semana
const NEW_BEGINNER_MAX_MONTHS = 6; // por debajo de esto, "principiante" cuenta como nuevo de verdad

// ─── BMR / TDEE ───────────────────────────────────────────────────────────

// Mifflin-St Jeor. Si falta algún dato de identidad, no inventa un número —
// ver computeStrategyPlan, que cae al fallback fijo (DEFAULT_GOALS actual)
// cuando no hay suficiente base para calcular.
function computeBMR(weightKg: number, heightCm: number, ageYears: number, sex: Sex | null): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  // 'other' o sin especificar: punto medio entre las dos fórmulas, no un
  // sesgo hacia ninguna — mejor que forzar una opción por defecto.
  return base - 78;
}

// ─── STRATEGY PLANNER ───────────────────────────────────────────────────

export function computeStrategyPlan(ctx: StrategyPlannerContext): StrategyPlan {
  const nutritionExplanations: string[] = [];
  const trainingExplanations: string[] = [];
  const { type: goalType, evaluation } = ctx.goal;
  const { ageYears, sex, heightCm, currentWeightKg } = ctx.identity;

  const hasIdentityForBMR = ageYears !== null && heightCm !== null && currentWeightKg !== null;

  let kcal: number;
  let proteinG: number;

  if (hasIdentityForBMR) {
    const bmr = computeBMR(currentWeightKg!, heightCm!, ageYears!, sex);
    const activityMultiplier = ACTIVITY_MULTIPLIER[ctx.lifestyle.dailyActivity ?? 'medium'];
    const tdee = bmr * activityMultiplier;
    kcal = Math.round(tdee + KCAL_ADJUSTMENT[goalType]);
    proteinG = Math.round(currentWeightKg! * PROTEIN_G_PER_KG[goalType]);
    nutritionExplanations.push(
      'Calculamos tus calorías a partir de tu peso, altura, edad y nivel de actividad, y las subimos o bajamos según tu objetivo.'
    );
  } else {
    // Sin edad/altura/peso no hay base real para calcular — fallback
    // conservador en vez de inventar (mismo punto de partida que
    // DEFAULT_GOALS ya usaba en nutrition-engine.ts), pero el objetivo
    // sigue aplicando su ajuste: sin esto, el resultado era idéntico
    // pasara lo que pasara el objetivo, que es justo lo que no debe pasar.
    kcal = Math.round(2900 + KCAL_ADJUSTMENT[goalType]);
    proteinG = 155;
    nutritionExplanations.push(
      'Todavía no tenemos tu edad, altura o peso, así que partimos de un valor típico y lo ajustamos según tu objetivo. Rellena tu perfil para un cálculo hecho a tu medida.'
    );
  }

  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((kcal / 1000) * 14);
  const mealsPerDay = ctx.nutrition.mealsPerDayPreferred ?? DEFAULT_MEALS_PER_DAY;

  const daysPerWeek = ctx.training.daysPerWeekPreferred ?? DEFAULT_DAYS_PER_WEEK[goalType];
  if (ctx.training.daysPerWeekPreferred !== null) {
    trainingExplanations.push('Usamos los días de entreno que ya tenías guardados.');
  } else {
    trainingExplanations.push('No teníamos guardados tus días de entreno preferidos, así que proponemos un número típico para tu objetivo.');
  }

  const phase = suggestPhaseForGoal(goalType);
  const level = EXPERIENCE_TO_LEVEL[ctx.training.experience ?? 'beginner'];

  let cardioSessions = DEFAULT_CARDIO_SESSIONS[goalType];
  if (ctx.recovery?.readiness === 'fatigued') {
    cardioSessions = Math.max(0, cardioSessions - 1);
    trainingExplanations.push('Bajamos el cardio porque tu cuerpo está pidiendo recuperación estos días.');
  } else if (cardioSessions === 0) {
    trainingExplanations.push('Con tu objetivo actual no hace falta añadir cardio aparte.');
  } else {
    trainingExplanations.push(`Añadimos ${cardioSessions} sesiones de cardio suave a la semana porque ayuda con tu objetivo.`);
  }

  const confidence: StrategyPlan['confidence'] = evaluation?.confidence === 'measured' ? 'measured' : 'generic';
  const confidenceNote =
    confidence === 'measured'
      ? 'Estos números ya tienen en cuenta cómo ha ido evolucionando tu progreso real.'
      : 'Todavía no hay suficiente historial tuyo, así que esto es un punto de partida razonable — se irá afinando con el tiempo.';
  nutritionExplanations.push(confidenceNote);
  trainingExplanations.push(confidenceNote);

  return {
    confidence,
    nutrition: {
      kcal,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      fiber_g: fiberG,
      mealsPerDay,
    },
    training: {
      daysPerWeek,
      phase,
      level,
    },
    cardio: {
      sessionsPerWeek: cardioSessions,
    },
    recovery: {
      sleepHoursTarget: GENERIC_SLEEP_HOURS_TARGET,
    },
    steps: {
      dailyStepsTarget: GENERIC_DAILY_STEPS_TARGET,
    },
    water: {
      dailyMlTarget: GENERIC_DAILY_WATER_ML_TARGET,
    },
    explanations: {
      nutrition: nutritionExplanations,
      training: trainingExplanations,
    },
  };
}

// ─── VALIDATION ───────────────────────────────────────────────────────────
// Revisa el StrategyPlan ya generado en busca de combinaciones incoherentes
// o inseguras y las corrige — nunca en silencio, cada ajuste queda en
// `conflicts` (y se añade también a `explanations` del plan devuelto).

export type ValidationResult = {
  plan: StrategyPlan;
  conflicts: { nutrition: string[]; training: string[] };
};

// Recalcula grasa/carbohidratos con las mismas fórmulas del Strategy
// Planner cuando kcal cambia después de un ajuste — la proteína no se
// toca, depende del peso corporal, no de las kcal totales.
function recomputeFatAndCarbs(kcal: number, proteinG: number): { fat_g: number; carbs_g: number } {
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { fat_g: fatG, carbs_g: carbsG };
}

export function validateStrategyPlan(plan: StrategyPlan, ctx: StrategyPlannerContext): ValidationResult {
  const nutritionConflicts: string[] = [];
  const trainingConflicts: string[] = [];
  let nutrition = { ...plan.nutrition };
  let training = { ...plan.training };

  const applyKcalFloor = (floor: number, reason: string) => {
    if (nutrition.kcal < floor) {
      nutritionConflicts.push(`Subimos tus calorías a ${floor} kcal — ${reason}.`);
      nutrition = { ...nutrition, kcal: floor, ...recomputeFatAndCarbs(floor, nutrition.protein_g) };
    }
  };

  // 1. Suelo calórico absoluto.
  applyKcalFloor(MIN_SAFE_KCAL, 'el número calculado era demasiado bajo para ser seguro');

  // 2. Suelo más alto si hay mucha carga de entreno (ej. 5 días/semana con
  // 1200 kcal no es viable, aunque 1200 solo ya pase el chequeo anterior).
  if (training.daysPerWeek >= HIGH_FREQUENCY_DAYS_PER_WEEK) {
    applyKcalFloor(MIN_SAFE_KCAL_HIGH_FREQUENCY, `con ${training.daysPerWeek} entrenos a la semana hacía falta más margen`);
  }

  // 3. Principiante con pocos meses entrenando — tope de días/semana.
  const isNewBeginner = ctx.training.experience === 'beginner' && (ctx.training.trainingMonths ?? 0) < NEW_BEGINNER_MAX_MONTHS;
  if (isNewBeginner && training.daysPerWeek > MAX_DAYS_PER_WEEK_NEW_BEGINNER) {
    trainingConflicts.push(
      `Bajamos tus días de entreno a ${MAX_DAYS_PER_WEEK_NEW_BEGINNER} a la semana — al llevar poco tiempo entrenando, mejor progresar poco a poco.`
    );
    training = { ...training, daysPerWeek: MAX_DAYS_PER_WEEK_NEW_BEGINNER };
  }

  const adjustedPlan: StrategyPlan = {
    ...plan,
    nutrition,
    training,
    explanations: {
      nutrition: [...plan.explanations.nutrition, ...nutritionConflicts],
      training: [...plan.explanations.training, ...trainingConflicts],
    },
  };

  return { plan: adjustedPlan, conflicts: { nutrition: nutritionConflicts, training: trainingConflicts } };
}

// ─── DAILY FOCUS ──────────────────────────────────────────────────────────
// Paso 6 (Daily planning) del pipeline, versión mínima: mira recuperación +
// entreno + nutrición a la vez (solo el Recommendation Engine puede hacer
// esto) y elige UNA cosa que destacar hoy, no una lista de todo. Pura,
// reglas fijas — igual que el resto, sin IA todavía.

export type DailyFocus = {
  headline: string;
  icon: 'battery-charging' | 'activity' | 'zap';
  // 'nutrition' es la única donde el caller puede sustituir `headline` por
  // la frase real del Insight Engine (con IA) si la tiene — este motor no
  // sabe nada de eso, solo decide que hoy toca hablar de comida.
  domain: 'recovery' | 'training' | 'nutrition';
};

export type DailyFocusInput = {
  readiness: RecoveryStatus | null;
  hasSessionToday: boolean;
  sessionLabel: string | null;
  kcalPct: number; // status.pct.kcal del día (0-1+, ver nutrition-engine.ts)
  proteinPct: number; // status.pct.protein_g del día
};

export function computeDailyFocus(input: DailyFocusInput): DailyFocus {
  const { readiness, hasSessionToday, sessionLabel, kcalPct, proteinPct } = input;

  // 1. Fatigado + entreno pendiente — la seguridad va antes que el plan.
  if (readiness === 'fatigued' && hasSessionToday) {
    return {
      headline: `Estás fatigado — antes de ${sessionLabel}, considera bajar la intensidad o descansar hoy.`,
      icon: 'battery-charging',
      domain: 'recovery',
    };
  }

  // 2. Entreno pendiente (sin fatiga) — es lo más importante del día.
  if (hasSessionToday) {
    return {
      headline: `Hoy toca ${sessionLabel} — es lo más importante que tienes por delante.`,
      icon: 'activity',
      domain: 'training',
    };
  }

  // 3. Sin entreno hoy — el foco pasa a nutrición.
  if (proteinPct < 0.5) {
    return { headline: 'Vas bajo de proteína hoy — una comida con más proteína te acerca al objetivo.', icon: 'zap', domain: 'nutrition' };
  }
  if (kcalPct >= 1.1) {
    return { headline: 'Ya has superado tu objetivo de calorías de hoy.', icon: 'zap', domain: 'nutrition' };
  }
  if (kcalPct < 0.5) {
    return { headline: 'Llevas pocas calorías registradas hoy — no te olvides de comer bien.', icon: 'zap', domain: 'nutrition' };
  }

  // 4. Nada urgente — sigue siendo sobre comida, no un genérico vacío.
  return { headline: 'Vas bien encaminado con tus macros de hoy — sigue así.', icon: 'zap', domain: 'nutrition' };
}
