// Goal Engine — lógica pura (sin Supabase, sin UI), ver docs/GOAL_ENGINE.md.
//
// No es un motor por-métrica: recibe una serie temporal genérica de una
// métrica (peso, 1RM estimado...) más un valor objetivo y una fecha
// opcional, y calcula tendencia real, factibilidad y si se va on-track.
// No sabe nada de nutrición, entrenamiento ni mesociclos — esos motores (o
// el Recommendation Engine más adelante) le dan los puntos ya calculados.
//
// Cuantos más puntos históricos haya, más fiable es la tendencia — con
// pocos puntos el motor no inventa un número, lo dice explícitamente
// (`status: 'insufficient_data'`). La única excepción es un ritmo
// *genérico* (no medido) para dar una primera estimación del día 1 en
// objetivos de peso — siempre marcado con `confidence: 'generic'`, nunca
// mezclado con una tendencia real (`confidence: 'measured'`).

import { ActivityLevel, Experience, GoalType } from '../../features/profile/engine/types';
import { Phase } from './types';

export type MetricPoint = { date: string; value: number }; // date: ISO (yyyy-mm-dd)

// Mínimo de datos para que una tendencia se considere fiable: al menos 3
// puntos repartidos en al menos 5 días. Por debajo de eso cualquier
// pendiente calculada es ruido, no una tasa real.
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 5;

export type GoalMetric = 'weight' | 'strength' | 'unsupported';

// A qué métrica observa el Goal Engine según el tipo de objetivo. stamina y
// mobility no tienen todavía una fuente de datos real (Cardio v2 / tracking
// de movilidad son piezas aparte) — quedan como 'unsupported' hasta que la
// tengan, no como error.
export const GOAL_METRICS: Record<GoalType, GoalMetric> = {
  lose_fat: 'weight',
  gain_muscle: 'weight',
  maintain: 'weight',
  strength: 'strength',
  stamina: 'unsupported',
  mobility: 'unsupported',
};

// Traducción pequeña hacia el vocabulario de Training — solo para los
// objetivos de peso, que sí mapean a una fase de mesociclo. El resto de
// objetivos no tiene equivalente y no debería forzarse a tenerlo.
export function suggestPhaseForGoal(type: GoalType): Phase | null {
  if (type === 'lose_fat') return 'definicion';
  if (type === 'gain_muscle') return 'volumen';
  if (type === 'maintain') return 'mantenimiento';
  return null;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (new Date(b).getTime() - new Date(a).getTime()) / msPerDay;
}

export type Trend = {
  ratePerWeek: number; // signed: positivo = la métrica sube, negativo = baja
  currentValue: number; // valor observado más reciente
  spanDays: number;
};

// Regresión lineal simple (mínimos cuadrados) sobre (día, valor). Se usa la
// pendiente para la tasa real de cambio, no la diferencia entre el primer y
// último punto — así un pico/valle puntual no descuadra la tendencia.
export function computeTrend(history: MetricPoint[]): Trend | null {
  if (history.length < MIN_POINTS) return null;
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0].date;
  const spanDays = daysBetween(first, sorted[sorted.length - 1].date);
  if (spanDays < MIN_SPAN_DAYS) return null;

  const xs = sorted.map((p) => daysBetween(first, p.date));
  const ys = sorted.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slopePerDay = den === 0 ? 0 : num / den;

  return {
    ratePerWeek: slopePerDay * 7,
    currentValue: sorted[sorted.length - 1].value,
    spanDays,
  };
}

// ─── Nivel base / ritmo genérico (estimación del día 1, sin histórico) ─────
//
// Combina señales que ya existen en el User Model (nadie pregunta nada
// nuevo para esto salvo trainingMonths) para elegir, muy a grandes rasgos,
// qué tan rápido es razonable esperar que alguien progrese. No sustituye
// nunca a una tendencia medida — solo rellena el hueco del día 1.
export type FitnessBaseline = 'low' | 'medium' | 'high';

export function estimateFitnessBaseline(input: {
  dailyActivity: ActivityLevel | null;
  daysPerWeek: number | null;
  trainingMonths: number | null;
  experience: Experience | null;
}): FitnessBaseline {
  let score = 0;
  if (input.dailyActivity === 'medium') score += 1;
  if (input.dailyActivity === 'high') score += 2;
  if (input.daysPerWeek != null) score += Math.min(input.daysPerWeek, 5) / 2.5; // 0-2
  if (input.trainingMonths != null) score += Math.min(input.trainingMonths, 24) / 12; // 0-2
  if (input.experience === 'advanced') score += 1;

  if (score >= 3.5) return 'high';
  if (score >= 1.5) return 'medium';
  return 'low';
}

// Ritmo genérico como % del peso actual por semana (magnitud, sin signo —
// la dirección la decide evaluateGoal según hacia dónde esté el objetivo).
// Cifras conservadoras de ritmo saludable habitual, no un máximo teórico.
// `maintain` no tiene ritmo genérico: no hay "prisa" que estimar.
const GENERIC_WEIGHT_RATE_PCT: Record<'lose_fat' | 'gain_muscle', Record<FitnessBaseline, number>> = {
  lose_fat: { low: 0.004, medium: 0.006, high: 0.008 },
  gain_muscle: { low: 0.0015, medium: 0.0025, high: 0.0035 },
};

// Magnitud (kg/semana) del ritmo genérico para un objetivo de peso, o null
// si no aplica (maintain, o currentValue desconocido).
export function genericWeightRateMagnitude(
  goalType: GoalType,
  currentValue: number | null,
  baseline: FitnessBaseline
): number | null {
  if (currentValue == null) return null;
  if (goalType !== 'lose_fat' && goalType !== 'gain_muscle') return null;
  return GENERIC_WEIGHT_RATE_PCT[goalType][baseline] * currentValue;
}

export type GoalStatus =
  | 'insufficient_data' // no hay ni histórico ni un punto de partida del que estimar nada
  | 'unsupported' // este tipo de objetivo no tiene fuente de datos conectada
  | 'reached' // ya está en el objetivo (o mejor)
  | 'on_track' // al ritmo actual llega a tiempo (o antes)
  | 'behind' // avanza en la dirección correcta pero no lo bastante rápido
  | 'off_track'; // se aleja del objetivo, o no se mueve en absoluto

export type GoalConfidence = 'measured' | 'generic';

export type GoalEvaluation = {
  status: GoalStatus;
  confidence: GoalConfidence | null; // null cuando no hay nada que evaluar (insufficient_data/unsupported)
  currentValue: number | null;
  targetValue: number | null;
  ratePerWeek: number | null; // ritmo real observado, o el genérico si confidence === 'generic'
  requiredRatePerWeek: number | null; // ritmo que haría falta para llegar en targetDate
  projectedDate: string | null; // fecha estimada de llegar al objetivo al ritmo actual
  message: string;
};

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

export type EvaluateGoalInput = {
  history: MetricPoint[];
  targetValue: number;
  targetDate?: string | null; // ISO date, opcional
  today?: string; // ISO date, por defecto hoy — parametrizable para tests
  // Ritmo genérico opcional (magnitud, sin signo) para cuando no hay
  // tendencia real todavía — normalmente de genericWeightRateMagnitude.
  // Requiere también un valor de partida (currentValue) si el histórico
  // está vacío del todo.
  genericRateMagnitude?: number | null;
  fallbackCurrentValue?: number | null;
};

// Punto de entrada principal. Genérico a propósito: no sabe si la métrica es
// peso o 1RM, solo compara "dónde estás" contra "dónde quieres estar" y a
// qué ritmo te mueves (medido, o a falta de eso, genérico).
export function evaluateGoal(input: EvaluateGoalInput): GoalEvaluation {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const trend = computeTrend(input.history);

  let currentValue: number | null;
  let ratePerWeek: number | null;
  let confidence: GoalConfidence | null;
  let genericNote = '';

  if (trend) {
    currentValue = trend.currentValue;
    ratePerWeek = trend.ratePerWeek;
    confidence = 'measured';
  } else {
    currentValue =
      input.history.length ? input.history[input.history.length - 1].value : input.fallbackCurrentValue ?? null;
    const remainingForDirection = currentValue != null ? input.targetValue - currentValue : null;
    if (currentValue != null && input.genericRateMagnitude != null && remainingForDirection !== 0) {
      ratePerWeek = Math.sign(remainingForDirection ?? 0) * Math.abs(input.genericRateMagnitude);
      confidence = 'generic';
      genericNote = 'Estimación genérica (ritmo típico, no tus datos todavía): ';
    } else {
      ratePerWeek = null;
      confidence = null;
    }
  }

  if (currentValue == null || ratePerWeek == null || confidence == null) {
    return {
      status: 'insufficient_data',
      confidence: null,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek: null,
      requiredRatePerWeek: null,
      projectedDate: null,
      message: 'Todavía no hay suficiente histórico para calcular una tendencia real.',
    };
  }

  const remaining = input.targetValue - currentValue;

  // Ya en el objetivo (con margen mínimo para no oscilar por ruido de medición)
  if (Math.abs(remaining) < 0.001) {
    return {
      status: 'reached',
      confidence,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek,
      requiredRatePerWeek: null,
      projectedDate: today,
      message: 'Ya estás en tu objetivo.',
    };
  }

  const neededDirection = Math.sign(remaining); // +1 si hay que subir, -1 si hay que bajar
  const actualDirection = Math.sign(ratePerWeek);

  // Se mueve en la dirección contraria (o no se mueve nada) — no aplica a
  // 'generic', que siempre se construye ya en la dirección necesaria
  if (confidence === 'measured' && (actualDirection !== neededDirection || ratePerWeek === 0)) {
    return {
      status: 'off_track',
      confidence,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek,
      requiredRatePerWeek: input.targetDate ? remaining / (daysBetween(today, input.targetDate) / 7) : null,
      projectedDate: null,
      message: 'Con el ritmo actual no te acercas al objetivo — vas en la dirección contraria o estancado.',
    };
  }

  const weeksToTarget = remaining / ratePerWeek;
  const projectedDate = addDays(today, weeksToTarget * 7);

  if (!input.targetDate) {
    return {
      status: 'on_track',
      confidence,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek,
      requiredRatePerWeek: null,
      projectedDate,
      message: `${genericNote}Al ritmo ${confidence === 'generic' ? 'típico para tu perfil' : 'actual'}, llegarías a tu objetivo alrededor de ${projectedDate}.`,
    };
  }

  const weeksAvailable = daysBetween(today, input.targetDate) / 7;
  const requiredRatePerWeek = weeksAvailable > 0 ? remaining / weeksAvailable : Infinity;
  // ratio > 1 significa que vas más rápido de lo necesario
  const ratio = requiredRatePerWeek === 0 ? 1 : ratePerWeek / requiredRatePerWeek;

  if (ratio >= 0.95) {
    return {
      status: 'on_track',
      confidence,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek,
      requiredRatePerWeek,
      projectedDate,
      message: `${genericNote}Vas on track para llegar el ${input.targetDate}.`,
    };
  }

  if (ratio >= 0.5) {
    return {
      status: 'behind',
      confidence,
      currentValue,
      targetValue: input.targetValue,
      ratePerWeek,
      requiredRatePerWeek,
      projectedDate,
      message: `${genericNote}Vas por detrás del ritmo necesario para el ${input.targetDate}. A este paso, la fecha real sería ${projectedDate}.`,
    };
  }

  return {
    status: 'off_track',
    confidence,
    currentValue,
    targetValue: input.targetValue,
    ratePerWeek,
    requiredRatePerWeek,
    projectedDate,
    message: `${genericNote}Muy por detrás del ritmo necesario para el ${input.targetDate}. Con el ritmo actual, la fecha estimada real es ${projectedDate}.`,
  };
}

// Fracción (0-1) recorrida desde el punto de partida hasta el objetivo —
// para el halo de progreso de Today. Distinto de "on_track/behind": esto no
// dice si vas al ritmo necesario, solo cuánto camino real llevas hecho.
// Se recorta a [0, 1] — pasarse del objetivo no pinta más del 100%.
export function progressFraction(startValue: number, currentValue: number, targetValue: number): number {
  const total = targetValue - startValue;
  if (total === 0) return 1;
  const done = (currentValue - startValue) / total;
  return Math.max(0, Math.min(1, done));
}

// Para cuando el usuario propone una fecha *antes* de tener histórico
// (p.ej. al fijar el objetivo por primera vez): sin datos reales el motor
// no puede estimar dificultad todavía, solo puede decirlo explícitamente.
// Se deja como función aparte (no oculta dentro de evaluateGoal) para que
// la UI pueda distinguir "objetivo recién creado" de "objetivo con
// histórico pero insuficiente".
export function canEvaluate(type: GoalType): boolean {
  return GOAL_METRICS[type] !== 'unsupported';
}
