import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { radius } from '../../constants/theme';
import { MesoSummary } from '../../lib/data/workout';
import { totalSessions } from '../../lib/engine/workout-engine';

const PHASE_LABEL: Record<string, string> = { volumen: 'Volume', mantenimiento: 'Maintenance', definicion: 'Cut' };
const LEVEL_LABEL: Record<string, string> = { principiante: 'Beginner', avanzado: 'Advanced' };

export function MesoMenu({
  loading,
  mesos,
  onSelect,
  onCreate,
}: {
  loading: boolean;
  mesos: MesoSummary[];
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { colors } = useAppTheme();

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Pressable
        onPress={onCreate}
        style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginBottom: 16 }}
      >
        <Text style={{ color: colors.accentText, fontWeight: '700' }}>+ New mesocycle</Text>
      </Pressable>

      {!mesos.length ? (
        <Card>
          <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>
            You don't have any mesocycle yet.
          </Text>
        </Card>
      ) : (
        mesos.map((m) => {
          const total = totalSessions(m);
          const pct = total ? Math.round((m.completed_sessions / total) * 100) : 0;
          return (
            <Pressable key={m.id} onPress={() => onSelect(m.id)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                      {PHASE_LABEL[m.phase]} · {m.duration_weeks} weeks
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                      {LEVEL_LABEL[m.level]} · {m.days_per_week} days/week
                    </Text>
                  </View>
                  <Text style={{ color: m.finished ? colors.success : colors.accent, fontSize: 12, fontWeight: '700' }}>
                    {m.finished ? 'Finished' : 'In progress'}
                  </Text>
                </View>
                {!m.finished ? (
                  <>
                    <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.surface2, marginTop: 10, marginBottom: 4, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.accent, borderRadius: 99 }} />
                    </View>
                    <Text style={{ color: colors.text2, fontSize: 12 }}>
                      Session {m.current_index + 1}/{total} ({pct}%)
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.text2, fontSize: 12, marginTop: 8 }}>{total} sessions completed</Text>
                )}
              </Card>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
