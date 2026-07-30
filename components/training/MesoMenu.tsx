import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
  onDelete,
  onBack,
}: {
  loading: boolean;
  mesos: MesoSummary[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onBack?: () => void;
}) {
  const { colors } = useAppTheme();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;

  const activeMeso = mesos.find((m) => !m.finished);

  return (
    <View>
      {onBack && (
        <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, marginBottom: 14 }}>
          <Feather name="chevron-left" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Training type</Text>
        </Pressable>
      )}

      {activeMeso ? (
        <Pressable onPress={() => onSelect(activeMeso.id)}>
          <Card style={{ backgroundColor: colors.surface2, borderColor: colors.accent }}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>MESOCYCLE IN PROGRESS</Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              Continue {PHASE_LABEL[activeMeso.phase]} · {activeMeso.duration_weeks} weeks
            </Text>
            <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>
              Finish or end it early before starting a new one.
            </Text>
          </Card>
        </Pressable>
      ) : (
        <Pressable
          onPress={onCreate}
          style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center', marginBottom: 16 }}
        >
          <Text style={{ color: colors.accentText, fontWeight: '700' }}>+ New mesocycle</Text>
        </Pressable>
      )}

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
          const isConfirming = confirmingId === m.id;
          return (
            <Card key={m.id}>
              <Pressable onPress={() => !isConfirming && onSelect(m.id)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                      {PHASE_LABEL[m.phase]} · {m.duration_weeks} weeks
                    </Text>
                    <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                      {LEVEL_LABEL[m.level]} · {m.days_per_week} days/week
                    </Text>
                  </View>
                  <Text style={{ color: m.finished ? colors.success : colors.accent, fontSize: 12, fontWeight: '700', marginRight: 10 }}>
                    {m.finished ? 'Finished' : 'In progress'}
                  </Text>
                  <Pressable onPress={() => setConfirmingId(isConfirming ? null : m.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.text2} />
                  </Pressable>
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
              </Pressable>

              {isConfirming && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      onDelete(m.id);
                      setConfirmingId(null);
                    }}
                    style={{ flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, padding: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Delete mesocycle</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmingId(null)}
                    style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.text2, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })
      )}
    </View>
  );
}
