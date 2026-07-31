import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../../components/Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { spacing, radius } from '../../constants/theme';
import { fetchMealsForDate } from '../../lib/data/nutrition';
import { computeMacroStatus, DEFAULT_GOALS, nutritionCoachLine } from '../../lib/engine/nutrition-engine';
import { fetchProfile } from '../../lib/data/profile';
import { fetchMesocycles, fetchMesocycleDetail } from '../../lib/data/workout';
import { getSessionDef } from '../../lib/engine/workout-engine';
import { Meal } from '../../lib/engine/types';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, todaysMeals, mesos] = await Promise.all([
        fetchProfile(userId).catch(() => null),
        fetchMealsForDate(),
        fetchMesocycles(userId).catch(() => []),
      ]);
      setName(profile?.name || null);
      setMeals(todaysMeals);

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
    const parts: string[] = [nutritionCoachLine(status)];
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
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{initial}</Text>
          </View>
        </View>

        {/* Objetivo — placeholder hasta que exista el Goal Engine */}
        <Card variant="glass">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>CURRENT GOAL</Text>
            <View style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>No goal set yet</Text>
          <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>
            Weight target, ETA and progress will show up here once goals are built.
          </Text>
        </Card>

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
      </ScrollView>
    </SafeAreaView>
  );
}
