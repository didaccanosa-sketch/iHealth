// Piezas de UI compartidas entre GoalCard (Progress) y GoalSummaryCard
// (Today) — solo presentación, la lógica vive en useGoalEvaluation /
// lib/engine/goal-engine.
import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '../../lib/theme-context';
import type { GoalType } from '../../features/profile/engine/types';
import type { GoalStatus, MetricPoint } from '../../lib/engine/goal-engine';

export const GOAL_TYPE_OPTIONS: { label: string; value: GoalType }[] = [
  { label: 'Perder grasa', value: 'lose_fat' },
  { label: 'Ganar músculo', value: 'gain_muscle' },
  { label: 'Mantenerme', value: 'maintain' },
  { label: 'Ganar fuerza', value: 'strength' },
  { label: 'Resistencia', value: 'stamina' },
  { label: 'Movilidad', value: 'mobility' },
];

export const STATUS_TEXT: Record<GoalStatus, string> = {
  insufficient_data: 'Necesito más registros para calcularlo de verdad',
  unsupported: 'Este objetivo aún no tiene datos conectados',
  reached: 'Objetivo alcanzado',
  on_track: 'On track',
  behind: 'Por detrás del ritmo',
  off_track: 'Fuera de ritmo',
};

export function statusColor(status: GoalStatus, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (status === 'reached' || status === 'on_track') return colors.success;
  if (status === 'behind') return colors.warning;
  if (status === 'off_track') return colors.danger;
  return colors.text2;
}

export function Sparkline({ points, color, height = 40 }: { points: MetricPoint[]; color: string; height?: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const last = points.slice(-14);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 3, marginTop: 8 }}>
      {last.map((p, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(((p.value - min) / range) * (height - 4), 3),
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}
