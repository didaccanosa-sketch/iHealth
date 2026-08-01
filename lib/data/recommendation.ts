// Recommendation Engine — "Context Builder" (paso 2 del pipeline, ver
// docs/RECOMMENDATION_ENGINE.md) + punto de entrada para pedir una
// recomendación real. Aquí sí se toca Supabase (a diferencia de
// lib/engine/recommendation-engine.ts, que es puro) — reúne User Model +
// Goal Engine + Recovery Engine y se lo pasa al Strategy Planner.
import { supabase } from '../supabase';
import { loadUserModel } from '../../features/profile/data/user-model-data';
import { fetchWeightHistory } from './weight-logs';
import { fetchStrengthHistory } from './strength-history';
import { fetchRecentSessionFeedback } from './workout';
import { evaluateGoal, GoalEvaluation, GOAL_METRICS } from '../engine/goal-engine';
import { evaluateRecovery } from '../engine/recovery-engine';
import { computeStrategyPlan, validateStrategyPlan, StrategyPlan, StrategyPlannerContext } from '../engine/recommendation-engine';

// Reúne el contexto real del usuario. Devuelve null si todavía no hay
// objetivo fijado — sin eso el Strategy Planner no tiene nada que planear.
export async function buildStrategyContext(userId: string): Promise<StrategyPlannerContext | null> {
  const model = await loadUserModel(userId);
  const goalType = model.goals.type.value;
  if (!goalType) return null;

  const metric = GOAL_METRICS[goalType];
  let evaluation: GoalEvaluation | null = null;
  let currentWeightKg = model.identity.startingWeightKg.value;

  if (metric === 'weight') {
    const history = await fetchWeightHistory(userId);
    if (history.length) currentWeightKg = history[history.length - 1].value;
    const targetValue = model.goals.targetWeightKg.value;
    if (targetValue != null) {
      evaluation = evaluateGoal({
        history,
        targetValue,
        targetDate: model.goals.targetDate.value,
        fallbackCurrentValue: currentWeightKg,
      });
    }
  } else if (metric === 'strength') {
    const exercise = model.goals.targetExercise.value;
    const targetValue = model.goals.targetExerciseKg.value;
    if (exercise && targetValue != null) {
      const history = await fetchStrengthHistory(userId, exercise);
      evaluation = evaluateGoal({ history, targetValue, targetDate: model.goals.targetDate.value });
    }
  }

  const recentFeedback = await fetchRecentSessionFeedback(userId).catch(() => []);
  const recovery = recentFeedback.length ? evaluateRecovery(recentFeedback) : null;

  return {
    goal: { type: goalType, evaluation },
    identity: {
      ageYears: model.identity.age.value,
      sex: model.identity.sex.value,
      heightCm: model.identity.heightCm.value,
      currentWeightKg,
    },
    training: {
      experience: model.training.experience.value,
      trainingMonths: model.training.trainingMonths.value,
      daysPerWeekPreferred: model.training.daysPerWeek.value,
      sessionLengthMin: model.lifestyle.sessionLengthMin.value,
    },
    nutrition: {
      mealsPerDayPreferred: model.nutrition.mealsPerDay.value,
    },
    lifestyle: {
      dailyActivity: model.lifestyle.dailyActivity.value,
    },
    recovery,
  };
}

// Punto de entrada único: contexto real -> Strategy Planner -> Validation.
// null si todavía no hay objetivo fijado (ver buildStrategyContext).
export async function getStrategyRecommendation(userId: string): Promise<StrategyPlan | null> {
  const ctx = await buildStrategyContext(userId);
  if (!ctx) return null;
  const plan = computeStrategyPlan(ctx);
  return validateStrategyPlan(plan, ctx).plan;
}

// Redacción con IA (capa de IA, paso 6) — coge los hechos en español sencillo
// que ya calculó el motor (StrategyPlan.explanations, por dominio) y los
// convierte en un párrafo natural y personalizado. Nunca inventa datos: la
// IA solo redacta lo que ya está en `facts`. Si falla (sin red, función no
// desplegada, cuota...), quien llama debe caer al texto de `facts` tal cual
// — no se cachea, se pide cada vez que el usuario abre el desplegable de info.
export async function explainRecommendation(domain: 'nutrition' | 'workout', facts: string[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('recommendation-explain', { body: { domain, facts } });
  if (error) throw error;
  if (!data?.text) throw new Error('Empty explanation response');
  return data.text as string;
}
