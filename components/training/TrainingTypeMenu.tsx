import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';

const TYPES: { id: string; label: string; desc: string; icon: keyof typeof Feather.glyphMap; available: boolean }[] = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy / Strength',
    desc: 'Mesocycles, RIR progression, weight suggestions',
    icon: 'trending-up',
    available: true,
  },
  {
    id: 'cardio',
    label: 'Cardio',
    desc: 'Distance, pace, heart rate tracking',
    icon: 'activity',
    available: false,
  },
  {
    id: 'functional',
    label: 'Functional / CrossFit',
    desc: 'WODs, timed and rep-based workouts',
    icon: 'zap',
    available: false,
  },
];

export function TrainingTypeMenu({ onSelectHypertrophy }: { onSelectHypertrophy: () => void }) {
  const { colors } = useAppTheme();

  return (
    <View>
      <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 14 }}>What kind of training do you want to log?</Text>
      {TYPES.map((t) => (
        <Pressable
          key={t.id}
          disabled={!t.available}
          onPress={() => {
            if (t.id === 'hypertrophy') onSelectHypertrophy();
          }}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            opacity: t.available ? 1 : 0.55,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={t.icon} size={20} color={t.available ? colors.accent : colors.text2} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t.label}</Text>
              {!t.available && (
                <View style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.text2, fontSize: 10, fontWeight: '700' }}>COMING SOON</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{t.desc}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
