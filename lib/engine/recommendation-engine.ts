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
import { RecoveryEvaluation } from './recovery-engine';
import { MacroGoals, Phase } from './types';

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
  explanations: string[]; // hechos en texto plano, no redacción de IA — para Validation y UI
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

const GENERIC_SLEEP_HOURS_TARGET = 8;
const GENERIC_DAILY_STEPS_TARGET = 8000;
const DEFAULT_MEALS_PER_DAY = 4;

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
  const explanations: string[] = [];
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
    explanations.push(
      `Calorías: TDEE estimado (Mifflin-St Jeor, actividad "${ctx.lifestyle.dailyActivity ?? 'medium (por defecto, sin dato)'}") ${Math.round(
        tdee
      )} kcal, ajustado ${KCAL_ADJUSTMENT[goalType] >= 0 ? '+' : ''}${KCAL_ADJUSTMENT[goalType]} kcal según objetivo "${goalType}".`
    );
  } else {
    // Sin edad/altura/peso no hay base real para BMR — fallback conservador
    // en vez de inventar. Mismo valor que DEFAULT_GOALS ya usaba en
    // nutrition-engine.ts, para no romper lo que ya existía.
    kcal = 2900;
    proteinG = 155;
    explanations.push('Calorías: sin edad/altura/peso suficientes para BMR real — se usa el valor genérico fijo de siempre.');
  }

  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((kcal / 1000) * 14);
  const mealsPerDay = ctx.nutrition.mealsPerDayPreferred ?? DEFAULT_MEALS_PER_DAY;

  const daysPerWeek = ctx.training.daysPerWeekPreferred ?? DEFAULT_DAYS_PER_WEEK[goalType];
  if (ctx.training.daysPerWeekPreferred !== null) {
    explanations.push(`Días de entreno: se respeta la preferencia del usuario (${daysPerWeek}/semana).`);
  } else {
    explanations.push(`Días de entreno: sin preferencia guardada, se usa el valor por defecto para "${goalType}" (${daysPerWeek}/semana).`);
  }

  const phase = suggestPhaseForGoal(goalType);

  let cardioSessions = DEFAULT_CARDIO_SESSIONS[goalType];
  if (ctx.recovery?.readiness === 'fatigued') {
    const before = cardioSessions;
    cardioSessions = Math.max(0, cardioSessions - 1);
    explanations.push(`Cardio: bajado de ${before} a ${cardioSessions} sesiones/semana porque el readiness actual es "fatigued".`);
  } else {
    explanations.push(`Cardio: ${cardioSessions} sesiones/semana para objetivo "${goalType}" (rango conservador documentado, sin ajuste de recuperación).`);
  }

  const confidence: StrategyPlan['confidence'] = evaluation?.confidence === 'measured' ? 'measured' : 'generic';
  explanations.push(
    confidence === 'measured'
      ? 'Confianza: "measured" — el Goal Engine tiene tendencia real medida para este objetivo.'
      : 'Confianza: "generic" — todavía no hay tendencia real medida, estos targets son un punto de partida razonable, no una medición.'
  );

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
    explanations,
  };
}

// ─── VALIDATION ───────────────────────────────────────────────────────────
// Revisa el StrategyPlan ya generado en busca de combinaciones incoherentes
// o inseguras y las corrige — nunca en silencio, cada ajuste queda en
// `conflicts` (y se añade también a `explanations` del plan devuelto).

export type ValidationResult = {
  plan: StrategyPlan;
  conflicts: string[];
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
  const conflicts: string[] = [];
  let nutrition = { ...plan.nutrition };
  let training = { ...plan.training };

  const applyKcalFloor = (floor: number, reason: string) => {
    if (nutrition.kcal < floor) {
      conflicts.push(`Kcal ajustadas de ${nutrition.kcal} a ${floor} — ${reason}.`);
      nutrition = { ...nutrition, kcal: floor, ...recomputeFatAndCarbs(floor, nutrition.protein_g) };
    }
  };

  // 1. Suelo calórico absoluto.
  applyKcalFloor(MIN_SAFE_KCAL, `por debajo del mínimo seguro (${MIN_SAFE_KCAL} kcal)`);

  // 2. Suelo más alto si hay mucha carga de entreno (ej. 5 días/semana con
  // 1200 kcal no es viable, aunque 1200 solo ya pase el chequeo anterior).
  if (training.daysPerWeek >= HIGH_FREQUENCY_DAYS_PER_WEEK) {
    applyKcalFloor(
      MIN_SAFE_KCAL_HIGH_FREQUENCY,
      `insuficiente para ${training.daysPerWeek} entrenos/semana (mínimo ${MIN_SAFE_KCAL_HIGH_FREQUENCY} kcal con esa frecuencia)`
    );
  }

  // 3. Principiante con pocos meses entrenando — tope de días/semana.
  const isNewBeginner = ctx.training.experience === 'beginner' && (ctx.training.trainingMonths ?? 0) < NEW_BEGINNER_MAX_MONTHS;
  if (isNewBeginner && training.daysPerWeek > MAX_DAYS_PER_WEEK_NEW_BEGINNER) {
    conflicts.push(
      `Días de entreno ajustados de ${training.daysPerWeek} a ${MAX_DAYS_PER_WEEK_NEW_BEGINNER} — principiante con menos de ${NEW_BEGINNER_MAX_MONTHS} meses entrenando.`
    );
    training = { ...training, daysPerWeek: MAX_DAYS_PER_WEEK_NEW_BEGINNER };
  }

  const adjustedPlan: StrategyPlan = {
    ...plan,
    nutrition,
    training,
    explanations: [...plan.explanations, ...conflicts],
  };

  return { plan: adjustedPlan, conflicts };
}
