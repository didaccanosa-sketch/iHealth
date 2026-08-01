import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { spacing, radius } from '../../constants/theme';
import { fetchMealsForDate, fetchMealsForDateRange, getNutritionInsight } from '../../lib/data/nutrition';
import { computeMacroStatus, DEFAULT_GOALS, nutritionCoachLine } from '../../lib/engine/nutrition-engine';
import { groupMealsByDate } from '../../lib/engine/nutritionInsight';
import { fetchProfile } from '../../lib/data/profile';
import { fetchMesocycles, fetchMesocycleDetail, fetchRecentSessionFeedback } from '../../lib/data/workout';
import { getSessionDef } from '../../lib/engine/workout-engine';
import { evaluateRecovery, RecoveryEvaluation } from '../../lib/engine/recovery-engine';
import { Meal } from '../../lib/engine/types';
import { QuestionCard } from '../../features/profile/QuestionCard';
import { GoalSummaryCard } from '../../components/goal/GoalSummaryCard';

type NextSession = { dayLabel: string; week: number; isDeload: boolean } | null;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 19) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id as string;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [nextSession, setNextSession] = useState<NextSession>(null);
  const [hasActiveMeso, setHasActiveMeso] = useState(false);
  const [nutritionLine, setNutritionLine] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryEvaluation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, todaysMeals, mesos, recentFeedback] = await Promise.all([
        fetchProfile(userId).catch(() => null),
        fetchMealsForDate(),
        fetchMesocycles(userId).catch(() => []),
        fetchRecentSessionFeedback(userId).catch(() => []),
      ]);
      setName(profile?.name || null);
      setMeals(todaysMeals);
      setRecovery(evaluateRecovery(recentFeedback));

      // Frase de reglas fijas al instante, para que Today no se quede en
      // blanco mientras llega (o no) la del Insight Engine con IA.
      const fallbackLine = nutritionCoachLine(computeMacroStatus(todaysMeals, DEFAULT_GOALS));
      setNutritionLine(fallbackLine);

      const active = mesos.find((m) => m.started && !m.finished);
      if (active) {
        setHasActiveMeso(true);
        const detail = await fetchMesocycleDetail(active.id);
        const def = getSessionDef(detail, detail.current_index);
        setNextSession({ dayLabel: def.dayLabel, week: def.week, isDeload: def.isDeload });
      } else {
        setHasActiveMeso(false);
        setNextSession(null);
      }

      // Insight con IA en segundo plano — no bloquea la pantalla. Si tarda,
      // falla o la función aún no está desplegada, se queda el fallback.
      const todayStr = new Date().toISOString().slice(0, 10);
      const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      fetchMealsForDateRange(threeDaysAgoStr, todayStr)
        .then((recentMeals) =>
          getNutritionInsight(userId, todaysMeals, groupMealsByDate(recentMeals), DEFAULT_GOALS, fallbackLine)
        )
        .then((result) => setNutritionLine(result.line))
        .catch(() => {
          // ya tenemos el fallback puesto, no hace falta hacer nada más
        });
    } catch {
      // si algo falla, se muestran los estados vacíos, sin romper la pantalla
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = computeMacroStatus(meals, DEFAULT_GOALS);
  const nutritionWord = status.pct.kcal >= 0.9 && status.pct.kcal <= 1.1 ? 'On track' : status.pct.kcal < 0.5 ? 'Just getting started' : status.pct.kcal > 1.15 ? 'Over target' : 'Almost there';
  const nutritionColor = nutritionWord === 'On track' ? colors.success : nutritionWord === 'Over target' ? colors.warning : colors.accent;

  const initial = (name || session?.user.email || '?').trim().charAt(0).toUpperCase();

  const summaryLine = (() => {
    const parts: string[] = [nutritionLine || nutritionCoachLine(status)];
    if (nextSession) parts.push(`Next up: ${nextSession.dayLabel} (week ${nextSession.week}).`);
    return parts.join(' ');
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <View>
            <Text style={{ color: colors.text2, fontSize: 14 }}>{greeting()},</Text>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>{name || 'there'}</Text>
            <Text style={{ color: colors.text2, fontSize: 13, marginTop: 2, textTransform: 'capitalize' }}>{todayLabel()}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{initial}</Text>
          </Pressable>
        </View>

        <GoalSummaryCard />

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Feather name="zap" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>{summaryLine}</Text>
              </View>
            </Card>

            {recovery && (
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>RECOVERY</Text>
                  <View style={{ backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>PROVISIONAL</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Feather
                    name="battery-charging"
                    size={16}
                    color={
                      recovery.readiness === 'fresh' ? colors.success : recovery.readiness === 'moderate' ? colors.warning : colors.danger
                    }
                    style={{ marginTop: 2 }}
                  />
                  <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>{recovery.message}</Text>
                </View>
              </Card>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable onPress={() => router.push('/nutrition')} style={{ flex: 1 }}>
                <Card>
                  <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Nutrition</Text>
                  <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 5, borderColor: nutritionColor, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{Math.round(status.pct.kcal * 100)}%</Text>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{nutritionWord}</Text>
                  <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2 }}>Tap for details</Text>
                </Card>
              </Pressable>

              <Pressable onPress={() => router.push('/training')} style={{ flex: 1 }}>
                <Card>
                  <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Up next</Text>
                  <Feather name="activity" size={24} color={colors.accent} style={{ marginBottom: 8 }} />
                  {hasActiveMeso && nextSession ? (
                    <>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                        {nextSession.dayLabel}
                      </Text>
                      <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2 }}>
                        Week {nextSession.week}
                        {nextSession.isDeload ? ' · Deload' : ''}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>No active plan</Text>
                      <Text style={{ color: colors.text2, fontSize: 11, marginTop: 2 }}>Tap to start one</Text>
                    </>
                  )}
                </Card>
              </Pressable>
            </View>
          </>
        )}

        {/* Espacio reservado para lo que aún no existe: agua, sueño, peso/tendencia */}
        <Card style={{ borderStyle: 'dashed', opacity: 0.5 }}>
          <Text style={{ color: colors.text2, fontSize: 12, textAlign: 'center' }}>
            Water, sleep and weight trend widgets will live here once those pieces are built.
          </Text>
        </Card>

        <QuestionCard userId={userId} />
      </ScrollView>
    </SafeAreaView>
  );
}
