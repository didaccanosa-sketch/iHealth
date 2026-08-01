// Versión compacta del Goal Engine para Today: solo vistazo, sin
// formularios. Fijar/editar el objetivo vive en Progress — aquí se tapa
// para llegar hasta allí. El halo es progreso de VALOR (cuánto llevas
// recorrido desde tu punto de partida), no progreso de tiempo — decisión
// explícita: refleja lo que de verdad has avanzado, sea cual sea el ritmo.
import React from 'react';
import { Text, Pressable, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { spacing } from '../../constants/theme';
import { GOAL_TYPE_OPTIONS, STATUS_TEXT, statusColor } from './shared';
import { useGoalEvaluation } from './useGoalEvaluation';

export function GoalSummaryCard() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id as string;

  const { loading, hasGoal, goalType, metric, evaluation, evalLoading, progress } = useGoalEvaluation(userId);

  if (loading) {
    return (
      <Card variant="glass">
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  if (!hasGoal) {
    return (
      <Pressable onPress={() => router.push('/progress')}>
        <Card variant="glass">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>CURRENT GOAL</Text>
            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>SET IT</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>No goal set yet</Text>
          <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>Tap to set a goal and get a first estimate.</Text>
        </Card>
      </Pressable>
    );
  }

  const color = evaluation ? statusColor(evaluation.status, colors) : colors.text2;
  const showRing = progress != null;

  return (
    <Pressable onPress={() => router.push('/progress')}>
      <Card variant="glass">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showRing ? spacing.sm : 0 }}>
          <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>CURRENT GOAL</Text>
          {evaluation?.confidence === 'generic' && (
            <View style={{ backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>GENERIC ESTIMATE</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {showRing && (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 5,
                borderColor: color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{Math.round((progress as number) * 100)}%</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {GOAL_TYPE_OPTIONS.find((o) => o.value === goalType)?.label}
            </Text>

            {evalLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
            ) : evaluation ? (
              <>
                <Text style={{ color, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{STATUS_TEXT[evaluation.status]}</Text>
                {evaluation.currentValue != null && evaluation.targetValue != null && (
                  <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                    {evaluation.currentValue.toFixed(1)} → {evaluation.targetValue}
                    {metric === 'weight' ? ' kg' : ' kg (1RM est.)'}
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                {metric === 'unsupported' ? 'No data connected for this goal yet.' : 'Not enough data yet for a real estimate.'}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
