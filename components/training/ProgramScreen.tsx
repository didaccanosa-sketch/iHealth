import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';
import { MesoSummary } from '../../lib/data/workout';
import { totalSessions } from '../../lib/engine/workout-engine';

// Primera pantalla de la pestaña Training. Hoy solo envuelve un mesociclo
// (1:1), pero es el sitio pensado para, más adelante, mostrar el contenido
// programado de la semana mezclando modalidades (meso + cardio + funcional)
// sin tener que insertar una pantalla nueva en el flujo — esta misma crece.
const PHASE_LABEL: Record<string, string> = { volumen: 'Volume', mantenimiento: 'Maintenance', definicion: 'Cut' };

function StartRow({
  icon,
  title,
  desc,
  onPress,
  disabled,
  disabledNote,
  comingSoon,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  onPress?: () => void;
  disabled?: boolean;
  disabledNote?: string;
  comingSoon?: boolean;
}) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || comingSoon;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        opacity: isDisabled ? 0.55 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={isDisabled ? colors.text2 : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{title}</Text>
          {comingSoon && (
            <View style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{disabled && disabledNote ? disabledNote : desc}</Text>
      </View>
      {!isDisabled && <Feather name="chevron-right" size={18} color={colors.text2} />}
    </Pressable>
  );
}

export function ProgramScreen({
  loading,
  mesos,
  onContinue,
  onCreate,
  onHistory,
  onCardio,
}: {
  loading: boolean;
  mesos: MesoSummary[];
  onContinue: (id: string) => void;
  onCreate: () => void;
  onHistory: () => void;
  onCardio: () => void;
}) {
  const { colors } = useAppTheme();

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;

  const activeMeso = mesos.find((m) => m.started && !m.finished);

  return (
    <View>
      <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 14 }}>Your training program</Text>

      {activeMeso && (
        (() => {
          const total = totalSessions(activeMeso);
          const pct = total ? Math.round((activeMeso.completed_sessions / total) * 100) : 0;
          return (
            <Pressable onPress={() => onContinue(activeMeso.id)}>
              <Card variant="glass" style={{ borderColor: colors.accent }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>PROGRAM ACTIVE</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                  {PHASE_LABEL[activeMeso.phase]} · {activeMeso.duration_weeks} weeks
                </Text>
                <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.surface2, marginTop: 12, marginBottom: 6, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.accent, borderRadius: 99 }} />
                </View>
                <Text style={{ color: colors.text2, fontSize: 12 }}>
                  Session {activeMeso.current_index + 1}/{total} ({pct}%) · tap to continue
                </Text>
              </Card>
            </Pressable>
          );
        })()
      )}

      <Text
        style={{
          color: colors.text2,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: activeMeso ? spacing.md : 0,
          marginBottom: 8,
        }}
      >
        Start something
      </Text>

      <StartRow
        icon="trending-up"
        title="New routine"
        desc="Mesocycles, RIR progression, weight suggestions"
        onPress={onCreate}
        disabled={!!activeMeso}
        disabledNote="Finish or end your current program first"
      />
      <StartRow icon="activity" title="Cardio" desc="Log a session, see your weekly/monthly trend" onPress={onCardio} />
      <StartRow icon="zap" title="Functional / CrossFit" desc="WODs, timed and rep-based workouts" comingSoon />

      {mesos.length > 0 && (
        <Pressable onPress={onHistory} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>View all mesocycles / history</Text>
        </Pressable>
      )}
    </View>
  );
}
