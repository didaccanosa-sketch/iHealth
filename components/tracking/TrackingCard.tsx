// Tracker de agua/sueño/pasos — solo Today, sin pantalla ni histórico propio
// (decidido así por ahora). Agua se registra a toques rápidos ("+vaso"),
// sueño y pasos con un número manual una vez al día — no hay integración con
// wearables todavía (ver TODO.md, pieza "Agua y sueño"). Los targets son
// genéricos fijos del Strategy Planner (`lib/engine/recommendation-engine.ts`),
// no personalizados todavía.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { spacing, radius } from '../../constants/theme';
import { fetchTodayTracking, addWater, logSleep, logSteps, TodayTracking } from '../../lib/data/tracking';
import {
  GENERIC_DAILY_WATER_ML_TARGET,
  GENERIC_SLEEP_HOURS_TARGET,
  GENERIC_DAILY_STEPS_TARGET,
} from '../../lib/engine/recommendation-engine';

const WATER_GLASS_ML = 250;

function ProgressRing({ pct, color, size = 40 }: { pct: number; color: string; size?: number }) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor: clamped > 0 ? color : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.text, fontSize: 10, fontWeight: '700' }}>{Math.round(clamped * 100)}%</Text>
    </View>
  );
}

export function TrackingCard() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TodayTracking>({ waterMl: 0, sleepHours: null, steps: null });
  const [addingWater, setAddingWater] = useState(false);

  const [sleepInput, setSleepInput] = useState('');
  const [stepsInput, setStepsInput] = useState('');
  const [savingSleep, setSavingSleep] = useState(false);
  const [savingSteps, setSavingSteps] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchTodayTracking(userId);
      setData(result);
      setSleepInput(result.sleepHours != null ? String(result.sleepHours) : '');
      setStepsInput(result.steps != null ? String(result.steps) : '');
    } catch {
      // se queda en los valores por defecto si falla, sin romper Today
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddWater = useCallback(async () => {
    setAddingWater(true);
    try {
      await addWater(userId, WATER_GLASS_ML);
      setData((prev) => ({ ...prev, waterMl: prev.waterMl + WATER_GLASS_ML }));
    } finally {
      setAddingWater(false);
    }
  }, [userId]);

  const submitSleep = useCallback(async () => {
    const hours = Number(sleepInput.trim());
    if (!sleepInput.trim() || Number.isNaN(hours)) return;
    setSavingSleep(true);
    try {
      await logSleep(userId, hours);
      setData((prev) => ({ ...prev, sleepHours: hours }));
    } finally {
      setSavingSleep(false);
    }
  }, [sleepInput, userId]);

  const submitSteps = useCallback(async () => {
    const steps = Number(stepsInput.trim());
    if (!stepsInput.trim() || Number.isNaN(steps)) return;
    setSavingSteps(true);
    try {
      await logSteps(userId, steps);
      setData((prev) => ({ ...prev, steps }));
    } finally {
      setSavingSteps(false);
    }
  }, [stepsInput, userId]);

  const inputStyle = {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    color: colors.text,
    fontSize: 13,
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  const waterPct = data.waterMl / GENERIC_DAILY_WATER_ML_TARGET;
  const sleepPct = (data.sleepHours ?? 0) / GENERIC_SLEEP_HOURS_TARGET;
  const stepsPct = (data.steps ?? 0) / GENERIC_DAILY_STEPS_TARGET;

  return (
    <Card>
      <Text style={{ color: colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md }}>
        WATER, SLEEP & STEPS
      </Text>

      {/* Agua */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <ProgressRing pct={waterPct} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{Math.round(data.waterMl)} ml</Text>
          <Text style={{ color: colors.text2, fontSize: 11 }}>Goal {GENERIC_DAILY_WATER_ML_TARGET} ml</Text>
        </View>
        <Pressable
          onPress={handleAddWater}
          disabled={addingWater}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: addingWater ? 0.6 : 1,
          }}
        >
          {addingWater ? (
            <ActivityIndicator color={colors.accentText} size="small" />
          ) : (
            <>
              <Feather name="plus" size={14} color={colors.accentText} />
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 12 }}>Glass</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Sueño */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <ProgressRing pct={sleepPct} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
            {data.sleepHours != null ? `${data.sleepHours}h` : 'Not logged'}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 11 }}>Goal {GENERIC_SLEEP_HOURS_TARGET}h</Text>
        </View>
        <TextInput
          value={sleepInput}
          onChangeText={setSleepInput}
          keyboardType="decimal-pad"
          placeholder="Hours"
          placeholderTextColor={colors.text2}
          style={[inputStyle, { width: 64, textAlign: 'center' }]}
        />
        <Pressable
          onPress={submitSleep}
          disabled={savingSleep}
          style={{ backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, opacity: savingSleep ? 0.6 : 1 }}
        >
          {savingSleep ? <ActivityIndicator color={colors.accent} size="small" /> : <Feather name="check" size={14} color={colors.accent} />}
        </Pressable>
      </View>

      {/* Pasos */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ProgressRing pct={stepsPct} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
            {data.steps != null ? `${data.steps} steps` : 'Not logged'}
          </Text>
          <Text style={{ color: colors.text2, fontSize: 11 }}>Goal {GENERIC_DAILY_STEPS_TARGET}</Text>
        </View>
        <TextInput
          value={stepsInput}
          onChangeText={setStepsInput}
          keyboardType="number-pad"
          placeholder="Steps"
          placeholderTextColor={colors.text2}
          style={[inputStyle, { width: 64, textAlign: 'center' }]}
        />
        <Pressable
          onPress={submitSteps}
          disabled={savingSteps}
          style={{ backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, opacity: savingSteps ? 0.6 : 1 }}
        >
          {savingSteps ? <ActivityIndicator color={colors.accent} size="small" /> : <Feather name="check" size={14} color={colors.accent} />}
        </Pressable>
      </View>
    </Card>
  );
}
