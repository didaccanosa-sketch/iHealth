// Goal Engine — UI. No decide nada por su cuenta: pide el objetivo al User
// Model, le da el histórico real (peso o fuerza) a lib/engine/goal-engine y
// muestra el veredicto tal cual. Ver docs/GOAL_ENGINE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius, spacing } from '../../constants/theme';
import { loadUserModel, saveUserModel } from '../../features/profile/data/user-model-data';
import { setField } from '../../features/profile/engine/user-model';
import type { GoalType, UserModelData } from '../../features/profile/engine/types';
import { evaluateGoal, GoalEvaluation, GoalStatus, GOAL_METRICS, canEvaluate, MetricPoint } from '../../lib/engine/goal-engine';
import { fetchWeightHistory, logWeight } from '../../lib/data/weight-logs';
import { fetchStrengthHistory } from '../../lib/data/strength-history';

const GOAL_TYPE_OPTIONS: { label: string; value: GoalType }[] = [
  { label: 'Perder grasa', value: 'lose_fat' },
  { label: 'Ganar músculo', value: 'gain_muscle' },
  { label: 'Mantenerme', value: 'maintain' },
  { label: 'Ganar fuerza', value: 'strength' },
  { label: 'Resistencia', value: 'stamina' },
  { label: 'Movilidad', value: 'mobility' },
];

const STATUS_TEXT: Record<GoalStatus, string> = {
  insufficient_data: 'Necesito más registros para calcularlo de verdad',
  unsupported: 'Este objetivo aún no tiene datos conectados',
  reached: 'Objetivo alcanzado',
  on_track: 'On track',
  behind: 'Por detrás del ritmo',
  off_track: 'Fuera de ritmo',
};

function statusColor(status: GoalStatus, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (status === 'reached' || status === 'on_track') return colors.success;
  if (status === 'behind') return colors.warning;
  if (status === 'off_track') return colors.danger;
  return colors.text2;
}

function Sparkline({ points, color }: { points: MetricPoint[]; color: string }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const last = points.slice(-14);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 3, marginTop: spacing.sm }}>
      {last.map((p, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(((p.value - min) / range) * 36, 3),
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

export function GoalCard() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [model, setModel] = useState<UserModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [evaluation, setEvaluation] = useState<GoalEvaluation | null>(null);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  const [type, setType] = useState<GoalType | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [targetExercise, setTargetExercise] = useState('');
  const [targetExerciseKg, setTargetExerciseKg] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [dateError, setDateError] = useState(false);

  const [weightInput, setWeightInput] = useState('');
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const hasGoal = !!model && model.goals.type.status === 'confirmed';

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
        if (metric === 'weight') {
          points = await fetchWeightHistory(userId);
          targetValue = m.goals.targetWeightKg.value;
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
        setEvaluation(evaluateGoal({ history: points, targetValue, targetDate: m.goals.targetDate.value }));
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
    // solo al montar — runEvaluation se dispara aparte cuando cambian datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const openEdit = useCallback(() => {
    if (model) {
      setType(model.goals.type.value);
      setTargetWeightKg(model.goals.targetWeightKg.value != null ? String(model.goals.targetWeightKg.value) : '');
      setTargetExercise(model.goals.targetExercise.value ?? '');
      setTargetExerciseKg(model.goals.targetExerciseKg.value != null ? String(model.goals.targetExerciseKg.value) : '');
      setTargetDate(model.goals.targetDate.value ?? '');
    }
    setDateError(false);
    setEditing(true);
  }, [model]);

  const saveGoal = useCallback(async () => {
    if (!model || !type) return;
    const trimmedDate = targetDate.trim();
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setDateError(true);
      return;
    }
    setSaving(true);
    let next = setField(model, 'goals', 'type', type);
    if (targetWeightKg.trim() && !Number.isNaN(Number(targetWeightKg))) {
      next = setField(next, 'goals', 'targetWeightKg', Number(targetWeightKg));
    }
    if (targetExercise.trim()) {
      next = setField(next, 'goals', 'targetExercise', targetExercise.trim());
    }
    if (targetExerciseKg.trim() && !Number.isNaN(Number(targetExerciseKg))) {
      next = setField(next, 'goals', 'targetExerciseKg', Number(targetExerciseKg));
    }
    if (trimmedDate) {
      next = setField(next, 'goals', 'targetDate', trimmedDate);
    }
    try {
      await saveUserModel(userId, next);
      setModel(next);
      setEditing(false);
      runEvaluation(next);
    } finally {
      setSaving(false);
    }
  }, [model, type, targetWeightKg, targetExercise, targetExerciseKg, targetDate, userId, runEvaluation]);

  const submitWeight = useCallback(async () => {
    const kg = Number(weightInput.trim());
    if (!weightInput.trim() || Number.isNaN(kg)) return;
    setLogging(true);
    try {
      await logWeight(userId, kg);
      setWeightInput('');
      setLogged(true);
      if (model) runEvaluation(model);
      setTimeout(() => setLogged(false), 2500);
    } finally {
      setLogging(false);
    }
  }, [weightInput, userId, model, runEvaluation]);

  const inputStyle = {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  if (editing || !hasGoal) {
    const selectedMetric = type ? GOAL_METRICS[type] : null;
    return (
      <Card>
        <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md }}>
          TU OBJETIVO
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {GOAL_TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setType(opt.value)}
                style={{
                  backgroundColor: active ? colors.accent : colors.surface2,
                  borderRadius: radius.md,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600', fontSize: 13 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {(type === 'lose_fat' || type === 'gain_muscle') && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Peso objetivo (kg)</Text>
            <TextInput
              value={targetWeightKg}
              onChangeText={setTargetWeightKg}
              keyboardType="decimal-pad"
              placeholder="e.g. 78"
              placeholderTextColor={colors.text2}
              style={inputStyle}
            />
          </View>
        )}

        {type === 'strength' && (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Ejercicio</Text>
              <TextInput
                value={targetExercise}
                onChangeText={setTargetExercise}
                placeholder="e.g. Sentadilla"
                placeholderTextColor={colors.text2}
                style={inputStyle}
              />
            </View>
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>1RM estimado objetivo (kg)</Text>
              <TextInput
                value={targetExerciseKg}
                onChangeText={setTargetExerciseKg}
                keyboardType="decimal-pad"
                placeholder="e.g. 120"
                placeholderTextColor={colors.text2}
                style={inputStyle}
              />
            </View>
          </>
        )}

        {(selectedMetric === 'unsupported') && (
          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: spacing.md }}>
            Este objetivo se puede guardar, pero todavía no hay datos que registrar para él — no dará una predicción real hasta que se construya.
          </Text>
        )}

        {type && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Fecha objetivo (opcional, AAAA-MM-DD)</Text>
            <TextInput
              value={targetDate}
              onChangeText={(v) => {
                setTargetDate(v);
                setDateError(false);
              }}
              placeholder="e.g. 2026-12-01"
              placeholderTextColor={colors.text2}
              style={inputStyle}
            />
            {dateError && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>Formato de fecha inválido</Text>}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {hasGoal && (
            <Pressable
              onPress={() => setEditing(false)}
              style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancelar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={saveGoal}
            disabled={!type || saving}
            style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center', opacity: !type || saving ? 0.6 : 1 }}
          >
            {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={{ color: colors.accentText, fontWeight: '700' }}>Guardar objetivo</Text>}
          </Pressable>
        </View>
      </Card>
    );
  }

  const goalType = model!.goals.type.value as GoalType;
  const metric = GOAL_METRICS[goalType];
  const color = evaluation ? statusColor(evaluation.status, colors) : colors.text2;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>TU OBJETIVO</Text>
        <Pressable onPress={openEdit}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Editar</Text>
        </Pressable>
      </View>

      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
        {GOAL_TYPE_OPTIONS.find((o) => o.value === goalType)?.label}
        {goalType === 'strength' && model!.goals.targetExercise.value ? ` — ${model!.goals.targetExercise.value}` : ''}
      </Text>

      {evalLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm }} />}

      {!evalLoading && evaluation && (
        <>
          <Text style={{ color, fontSize: 14, fontWeight: '700', marginTop: 6 }}>{STATUS_TEXT[evaluation.status]}</Text>
          <Text style={{ color: colors.text2, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{evaluation.message}</Text>
          {evaluation.currentValue != null && evaluation.targetValue != null && (
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 6 }}>
              {evaluation.currentValue.toFixed(1)} → {evaluation.targetValue}
              {metric === 'weight' ? ' kg' : ' kg (1RM est.)'}
            </Text>
          )}
          <Sparkline points={history} color={color} />
        </>
      )}

      {!evalLoading && !evaluation && metric !== 'unsupported' && (
        <Text style={{ color: colors.text2, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          {history.length < 3
            ? 'Todavía no hay suficiente histórico para calcular una tendencia real.'
            : 'Falta poner un valor objetivo para poder evaluar esto.'}
        </Text>
      )}

      {!evalLoading && metric === 'unsupported' && (
        <Text style={{ color: colors.text2, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          Este objetivo todavía no tiene una fuente de datos conectada.
        </Text>
      )}

      {metric === 'weight' && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TextInput
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="Peso de hoy (kg)"
            placeholderTextColor={colors.text2}
            style={[inputStyle, { flex: 1 }]}
          />
          <Pressable
            onPress={submitWeight}
            disabled={logging}
            style={{ backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center', opacity: logging ? 0.6 : 1 }}
          >
            {logging ? <ActivityIndicator color={colors.accentText} /> : <Text style={{ color: colors.accentText, fontWeight: '700' }}>Registrar</Text>}
          </Pressable>
        </View>
      )}
      {logged && <Text style={{ color: colors.success, fontSize: 12, marginTop: 6 }}>Registrado</Text>}
    </Card>
  );
}
