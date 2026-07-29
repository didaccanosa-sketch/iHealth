import React from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '../lib/theme-context';

export function MacroBar({
  label,
  current,
  goal,
  unit,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  const pct = goal > 0 ? Math.max(0, Math.min(1, current / goal)) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
          {Math.round(current)}
          {unit} / {Math.round(goal)}
          {unit}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.surface2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: color, borderRadius: 99 }} />
      </View>
    </View>
  );
}
