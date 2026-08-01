// Goal Engine — UI completa (Progress): fijar/editar objetivo, ver
// veredicto y registrar peso. La versión compacta de solo lectura vive en
// GoalSummaryCard (Today). Ambas comparten datos vía useGoalEvaluation.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius, spacing } from '../../constants/theme';
import { saveUserModel } from '../../features/profile/data/user-model-data';
import { setField } from '../../features/profile/engine/user-model';
import type { GoalType } from '../../features/profile/engine/types';
import { Sparkline, STATUS_TEXT, statusColor, GOAL_TYPE_OPTIONS } from './shared';
import { GOAL_METRICS } from '../../lib/engine/goal-engine';
import { logWeight } from '../../lib/data/weight-logs';
import { useGoalEvaluation } from './useGoalEvaluation';

export function GoalCard() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const { model, loading, hasGoal, goalType, metric, evaluation, evalLoading, history, applyModel, refresh } =
    useGoalEvaluation(userId);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<GoalType | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [targetExercise, setTargetExercise] = useState('');
  const [targetExerciseKg, setTargetExerciseKg] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [dateError, setDateError] = useState(false);

  const [weightInput, setWeightInput] = useState('');
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

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
      applyModel(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [model, type, targetWeightKg, targetExercise, targetExerciseKg, targetDate, userId, applyModel]);

  const submitWeight = useCallback(async () => {
    const kg = Number(weightInput.trim());
    if (!weightInput.trim() || Number.isNaN(kg)) return;
    setLogging(true);
    try {
      await logWeight(userId, kg);
      setWeightInput('');
      setLogged(true);
      refresh();
      setTimeout(() => setLogged(false), 2500);
    } finally {
      setLogging(false);
    }
  }, [weightInput, userId, refresh]);

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

        {selectedMetric === 'unsupported' && (
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{STATUS_TEXT[evaluation.status]}</Text>
            {evaluation.confidence === 'generic' && (
              <View style={{ backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>ESTIMACIÓN GENÉRICA</Text>
              </View>
            )}
          </View>
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
