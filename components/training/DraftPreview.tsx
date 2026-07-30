import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { radius } from '../../constants/theme';
import { Mesocycle } from '../../lib/engine/types';

const PHASE_LABEL: Record<string, string> = { volumen: 'Volume', mantenimiento: 'Maintenance', definicion: 'Cut' };
const LEVEL_LABEL: Record<string, string> = { principiante: 'Beginner', avanzado: 'Advanced' };

export function DraftPreview({
  meso,
  blockedReason,
  onStart,
  onBack,
}: {
  meso: Mesocycle;
  blockedReason: string | null;
  onStart: () => void;
  onBack: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.text2 }}>← Mesocycles</Text>
      </Pressable>

      <Card>
        <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>DRAFT — NOT STARTED</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
          {PHASE_LABEL[meso.phase]} · {meso.duration_weeks} weeks
        </Text>
        <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
          {LEVEL_LABEL[meso.level]} · {meso.days_per_week} days/week
        </Text>
      </Card>

      {meso.days.map((d) => (
        <Card key={d.id}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>{d.label}</Text>
          {d.exercises.map((e) => (
            <Text key={e.id} style={{ color: colors.text2, fontSize: 12, marginBottom: 2 }}>
              {e.name} — {e.sets}×{e.reps}
            </Text>
          ))}
        </Card>
      ))}

      {blockedReason && (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10 }}>{blockedReason}</Text>
      )}

      <Pressable
        onPress={onStart}
        disabled={!!blockedReason}
        style={{
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          padding: 14,
          alignItems: 'center',
          opacity: blockedReason ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.accentText, fontWeight: '700' }}>Start this mesocycle</Text>
      </Pressable>
    </View>
  );
}
