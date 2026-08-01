// Hook compartido entre GoalCard (Progress, edición completa) y
// GoalSummaryCard (Today, solo vistazo) — carga el User Model y pide al
// Goal Engine el veredicto del objetivo activo. Ninguno de los dos
// componentes debe repetir esta lógica por separado.
import { useCallback, useEffect, useState } from 'react';
import { loadUserModel } from '../../features/profile/data/user-model-data';
import type { GoalType, UserModelData } from '../../features/profile/engine/types';
import {
  evaluateGoal,
  GoalEvaluation,
  GOAL_METRICS,
  canEvaluate,
  MetricPoint,
  estimateFitnessBaseline,
  genericWeightRateMagnitude,
} from '../../lib/engine/goal-engine';
import { fetchWeightHistory } from '../../lib/data/weight-logs';
import { fetchStrengthHistory } from '../../lib/data/strength-history';

export function useGoalEvaluation(userId: string) {
  const [model, setModel] = useState<UserModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<GoalEvaluation | null>(null);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  const runEvaluation = useCallback(
    async (m: UserModelData) => {
      const goalType = m.goals.type.value;
      if (!goalType || !canEvaluate(goalType)) {
        setEvaluation(null);
        setHistory([]);
        return;
      }
      setEvalLoading(true);
      try {
        const metric = GOAL_METRICS[goalType];
        let points: MetricPoint[] = [];
        let targetValue: number | null = null;
        let fallbackCurrentValue: number | null = null;
        let genericRateMagnitude: number | null = null;
        if (metric === 'weight') {
          points = await fetchWeightHistory(userId);
          targetValue = m.goals.targetWeightKg.value;
          fallbackCurrentValue = points.length ? null : m.identity.startingWeightKg.value;
          const referenceValue = points.length ? points[points.length - 1].value : fallbackCurrentValue;
          const baseline = estimateFitnessBaseline({
            dailyActivity: m.lifestyle.dailyActivity.value,
            daysPerWeek: m.training.daysPerWeek.value,
            trainingMonths: m.training.trainingMonths.value,
            experience: m.training.experience.value,
          });
          genericRateMagnitude = genericWeightRateMagnitude(goalType, referenceValue, baseline);
        } else if (metric === 'strength') {
          const exercise = m.goals.targetExercise.value;
          if (exercise) points = await fetchStrengthHistory(userId, exercise);
          targetValue = m.goals.targetExerciseKg.value;
        }
        setHistory(points);
        if (targetValue == null) {
          setEvaluation(null);
          return;
        }
        setEvaluation(
          evaluateGoal({
            history: points,
            targetValue,
            targetDate: m.goals.targetDate.value,
            fallbackCurrentValue,
            genericRateMagnitude,
          })
        );
      } catch {
        setEvaluation(null);
      } finally {
        setEvalLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    loadUserModel(userId)
      .then((m) => {
        if (cancelled) return;
        setModel(m);
        setLoading(false);
        if (m.goals.type.status === 'confirmed') runEvaluation(m);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
    // solo al montar — refresh()/applyModel() se usan para recalcular tras
    // una acción del usuario (guardar objetivo, registrar peso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const hasGoal = !!model && model.goals.type.status === 'confirmed';
  const goalType = (model?.goals.type.value ?? null) as GoalType | null;
  const metric = goalType ? GOAL_METRICS[goalType] : null;

  // Tras guardar un objetivo nuevo/editado
  const applyModel = useCallback(
    (next: UserModelData) => {
      setModel(next);
      runEvaluation(next);
    },
    [runEvaluation]
  );

  // Tras una acción que cambia el histórico (ej. registrar peso) sin tocar el modelo
  const refresh = useCallback(() => {
    if (model) runEvaluation(model);
  }, [model, runEvaluation]);

  return { model, loading, hasGoal, goalType, metric, evaluation, evalLoading, history, applyModel, refresh };
}
