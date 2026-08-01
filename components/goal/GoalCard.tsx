// Goal Engine — UI completa (Progress): fijar/editar objetivo, ver
// veredicto y registrar peso. La versión compacta de solo lectura vive en
// GoalSummaryCard (Today). Ambas comparten datos vía useGoalEvaluation.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius, spacing } from '../../constants/theme';
import { saveUserModel } from '../../features/profile/data/user-model-data';
import { setField } from '../../features/profile/engine/user-model';
import { Sparkline, STATUS_TEXT, statusColor, GOAL_TYPE_OPTIONS } from './shared';
import { logWeight } from '../../lib/data/weight-logs';
import { useGoalEvaluation } from './useGoalEvaluation';
import { interpretGoalText } from './interpret-goal';

export function GoalCard() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const { model, loading, hasGoal, goalType, metric, evaluation, evalLoading, history, applyModel, refresh } =
    useGoalEvaluation(userId);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [goalText, setGoalText] = useState('');
  const [interpretError, setInterpretError] = useState(false);

  const [weightInput, setWeightInput] = useState('');
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysWeight = history.find((p) => p.date === todayStr) ?? null;

  // Si hoy ya se registró un peso, el campo se rellena con ese valor en vez
  // de quedarse vacío — no se puede añadir uno segundo, solo corregir el de
  // hoy. Se sincroniza cuando cambia el histórico (carga inicial o tras
  // registrar/actualizar), no en cada pulsación de tecla.
  useEffect(() => {
    setWeightInput(todaysWeight ? String(todaysWeight.value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const openEdit = useCallback(() => {
    setGoalText('');
    setInterpretError(false);
    setEditing(true);
  }, []);

  const saveGoal = useCallback(async () => {
    if (!model || !goalText.trim()) return;
    setSaving(true);
    setInterpretError(false);
    try {
      const interpreted = await interpretGoalText(goalText.trim());
      if (!interpreted) {
        setInterpretError(true);
        return;
      }
      let next = setField(model, 'goals', 'type', interpreted.type);
      if (interpreted.targetWeightKg != null) {
        next = setField(next, 'goals', 'targetWeightKg', interpreted.targetWeightKg);
      }
      if (interpreted.targetExercise) {
        next = setField(next, 'goals', 'targetExercise', interpreted.targetExercise);
      }
      if (interpreted.targetExerciseKg != null) {
        next = setField(next, 'goals', 'targetExerciseKg', interpreted.targetExerciseKg);
      }
      if (interpreted.targetDate) {
        next = setField(next, 'goals', 'targetDate', interpreted.targetDate);
      }
      await saveUserModel(userId, next);
      applyModel(next);
      setEditing(false);
    } catch {
      setInterpretError(true);
    } finally {
      setSaving(false);
    }
  }, [model, goalText, userId, applyModel]);

  const submitWeight = useCallback(async () => {
    const kg = Number(weightInput.trim());
    if (!weightInput.trim() || Number.isNaN(kg)) return;
    setLogging(true);
    try {
      await logWeight(userId, kg);
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
    return (
      <Card>
        <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md }}>
          TU OBJETIVO
        </Text>
        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.sm, lineHeight: 18 }}>
          Cuéntame tu objetivo con tus palabras — por ejemplo "quiero bajar a 78kg para diciembre" o "subir mi sentadilla a 120kg".
        </Text>
        <TextInput
          value={goalText}
          onChangeText={(v) => {
            setGoalText(v);
            setInterpretError(false);
          }}
          placeholder="Escribe tu objetivo..."
          placeholderTextColor={colors.text2}
          multiline
          style={[inputStyle, { minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.md }]}
        />

        {interpretError && (
          <Text style={{ color: colors.danger, fontSize: 12, marginBottom: spacing.md, lineHeight: 18 }}>
            No he entendido bien ese objetivo — ¿puedes intentar explicarlo de otra forma?
          </Text>
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
            disabled={!goalText.trim() || saving}
            style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center', opacity: !goalText.trim() || saving ? 0.6 : 1 }}
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
        <>
          {todaysWeight && (
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: spacing.md }}>
              Ya has registrado tu peso hoy — puedes corregirlo aquí abajo.
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: todaysWeight ? 6 : spacing.md }}>
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
              {logging ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>{todaysWeight ? 'Actualizar' : 'Registrar'}</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
      {logged && <Text style={{ color: colors.success, fontSize: 12, marginTop: 6 }}>Guardado</Text>}
    </Card>
  );
}
