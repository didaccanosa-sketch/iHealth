import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius } from '../../constants/theme';
import { MuscleGroup } from '../../lib/engine/types';
import { MUSCLE_GROUPS } from '../../lib/engine/workout-engine';
import { listBuiltinTemplates, instantiateBuiltinTemplate, buildFocusSplit } from '../../lib/engine/meso-templates';
import { fetchUserMesoTemplates, deleteUserMesoTemplate, UserMesoTemplate } from '../../lib/data/workout';

type Tab = 'builtin' | 'mine' | 'focus';

export function TemplatePicker({
  onPick,
  onCancel,
}: {
  onPick: (days: { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] }[], daysPerWeek: number) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [tab, setTab] = useState<Tab>('builtin');
  const [userTemplates, setUserTemplates] = useState<UserMesoTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [focusDays, setFocusDays] = useState(5);
  const [focusGroups, setFocusGroups] = useState<MuscleGroup[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserMesoTemplates(userId);
      setUserTemplates(data);
    } catch {
      // silencioso — si falla, simplemente se ve la lista vacía
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const builtin = listBuiltinTemplates();
  const grouped = new Map<number, typeof builtin>();
  builtin.forEach((t) => {
    if (!grouped.has(t.daysPerWeek)) grouped.set(t.daysPerWeek, []);
    grouped.get(t.daysPerWeek)!.push(t);
  });

  function toggleFocusGroup(g: MuscleGroup) {
    setFocusGroups((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 2) return [prev[1], g];
      return [...prev, g];
    });
  }

  async function handleDeleteUserTemplate(id: string) {
    try {
      await deleteUserMesoTemplate(id);
      setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silencioso
    }
  }

  return (
    <View>
      <Pressable onPress={onCancel} style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.text2 }}>✕ Cancel</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginBottom: 16 }}>
        {(['builtin', 'mine', 'focus'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: tab === t ? colors.accent : 'transparent' }}
          >
            <Text style={{ color: tab === t ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 12 }}>
              {t === 'builtin' ? 'Built-in' : t === 'mine' ? 'My templates' : 'Focused split'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'builtin' &&
        Array.from(grouped.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([days, templates]) => (
            <View key={days} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {days} day{days === 1 ? '' : 's'}/week
              </Text>
              {templates.map((t) => (
                <Pressable key={t.id} onPress={() => onPick(instantiateBuiltinTemplate(t.id), t.daysPerWeek)}>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t.name}</Text>
                      <Feather name="chevron-right" size={18} color={colors.text2} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          ))}

      {tab === 'mine' &&
        (loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : !userTemplates.length ? (
          <Card>
            <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>
              You don't have any saved templates yet. Finish a mesocycle and save it as a template to see it here.
            </Text>
          </Card>
        ) : (
          userTemplates.map((t) => (
            <Card key={t.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable onPress={() => onPick(t.days, t.days_per_week)} style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t.name}</Text>
                  <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>{t.days_per_week} days/week</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteUserTemplate(t.id)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={colors.text2} />
                </Pressable>
              </View>
            </Card>
          ))
        ))}

      {tab === 'focus' && (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>Build a focused split</Text>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Training days per week</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
            {[4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                onPress={() => setFocusDays(n)}
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: focusDays === n ? colors.accent : colors.surface2, marginRight: 8, marginBottom: 8 }}
              >
                <Text style={{ color: focusDays === n ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Priority muscle groups (pick 1-2)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
            {MUSCLE_GROUPS.filter((g) => g.id !== 'core' && g.id !== 'lumbar' && g.id !== 'aductores' && g.id !== 'abductores').map((g) => (
              <Pressable
                key={g.id}
                onPress={() => toggleFocusGroup(g.id)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: focusGroups.includes(g.id) ? colors.accent : colors.surface2, marginRight: 8, marginBottom: 8 }}
              >
                <Text style={{ color: focusGroups.includes(g.id) ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 12 }}>{g.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => onPick(buildFocusSplit(focusDays, focusGroups), focusDays)}
            style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Generate split</Text>
          </Pressable>
        </Card>
      )}
    </View>
  );
}
