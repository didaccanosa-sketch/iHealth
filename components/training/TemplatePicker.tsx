import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Card } from '../Card';
import { FadeIn } from '../FadeIn';
import { useAppTheme } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { radius } from '../../constants/theme';
import { MuscleGroup, Level, Phase } from '../../lib/engine/types';
import { MUSCLE_GROUPS } from '../../lib/engine/workout-engine';
import { listBuiltinTemplates, instantiateBuiltinTemplate, buildFocusSplit } from '../../lib/engine/meso-templates';
import { fetchUserMesoTemplates, deleteUserMesoTemplate, UserMesoTemplate, NewMesoInput } from '../../lib/data/workout';
import { fetchPreferredTrainingDays, savePreferredTrainingDays } from '../../lib/data/profile';

type Tab = 'builtin' | 'mine' | 'focus';
const LEVELS: { id: Level; label: string }[] = [
  { id: 'principiante', label: 'Beginner' },
  { id: 'avanzado', label: 'Advanced' },
];
const PHASES: { id: Phase; label: string }[] = [
  { id: 'volumen', label: 'Volume' },
  { id: 'mantenimiento', label: 'Maintenance' },
  { id: 'definicion', label: 'Cut' },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: on ? colors.accent : colors.surface2, marginRight: 8, marginBottom: 8 }}
    >
      <Text style={{ color: on ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function TemplatePicker({
  onPick,
  onCancel,
}: {
  onPick: (input: NewMesoInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id as string;

  const [tab, setTab] = useState<Tab>('builtin');
  const [userTemplates, setUserTemplates] = useState<UserMesoTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [level, setLevel] = useState<Level>('principiante');
  const [phase, setPhase] = useState<Phase>('volumen');
  const [durationWeeks, setDurationWeeks] = useState(6);

  // Días de entreno: valor por defecto guardado en el perfil, pero siempre
  // se puede cambiar aquí mismo para este meso en concreto.
  const [days, setDays] = useState<number | null>(null);
  const [daysLoading, setDaysLoading] = useState(true);
  const [showAllDays, setShowAllDays] = useState(false);

  const [focusGroups, setFocusGroups] = useState<MuscleGroup[]>([]);

  useEffect(() => {
    fetchPreferredTrainingDays(userId)
      .then((d) => {
        setDays(d);
      })
      .finally(() => setDaysLoading(false));
  }, [userId]);

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

  async function chooseDays(n: number) {
    setDays(n);
    try {
      await savePreferredTrainingDays(userId, n);
    } catch {
      // si falla el guardado, el valor sigue funcionando para esta sesión igualmente
    }
  }

  const builtin = listBuiltinTemplates();
  const grouped = new Map<number, typeof builtin>();
  builtin.forEach((t) => {
    if (!grouped.has(t.daysPerWeek)) grouped.set(t.daysPerWeek, []);
    grouped.get(t.daysPerWeek)!.push(t);
  });
  const builtinEntries = Array.from(grouped.entries())
    .filter(([d]) => showAllDays || d === days)
    .sort((a, b) => a[0] - b[0]);
  const mineFiltered = userTemplates.filter((t) => showAllDays || t.days_per_week === days);

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

  function pickBuiltin(id: string, daysPerWeek: number) {
    onPick({ level, phase, duration_weeks: durationWeeks, days_per_week: daysPerWeek, days: instantiateBuiltinTemplate(id) });
  }

  function pickUserTemplate(t: UserMesoTemplate) {
    onPick({ level, phase, duration_weeks: durationWeeks, days_per_week: t.days_per_week, days: t.days });
  }

  function generateFocus() {
    if (!days) return;
    onPick({
      level,
      phase,
      duration_weeks: durationWeeks,
      days_per_week: days,
      days: buildFocusSplit(days, focusGroups),
      generatedFrom: 'focus',
      focusPriority: focusGroups,
    });
  }

  if (daysLoading) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;
  }

  return (
    <View>
      <Pressable onPress={onCancel} style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.text2 }}>✕ Cancel</Text>
      </Pressable>

      <Card>
        <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Training days per week</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Chip key={n} label={String(n)} on={days === n} onPress={() => chooseDays(n)} />
          ))}
        </View>
        {days != null && (
          <Text style={{ color: colors.text2, fontSize: 11, marginTop: 4 }}>Saved as your default — change it any time here or in Settings later.</Text>
        )}
      </Card>

      {days == null ? (
        <Card>
          <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>Pick your training days above to continue.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>Mesocycle settings</Text>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Level</Text>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              {LEVELS.map((l) => (
                <Chip key={l.id} label={l.label} on={level === l.id} onPress={() => setLevel(l.id)} />
              ))}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Phase</Text>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              {PHASES.map((p) => (
                <Chip key={p.id} label={p.label} on={phase === p.id} onPress={() => setPhase(p.id)} />
              ))}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Duration (weeks, deload not included)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[4, 5, 6, 7, 8].map((n) => (
                <Chip key={n} label={String(n)} on={durationWeeks === n} onPress={() => setDurationWeeks(n)} />
              ))}
            </View>
          </Card>

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

          <FadeIn trigger={tab}>
            {(tab === 'builtin' || tab === 'mine') && (
              <Pressable onPress={() => setShowAllDays((v) => !v)} style={{ marginBottom: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                  {showAllDays ? `Show only ${days}-day templates` : 'Show templates for all day counts'}
                </Text>
              </Pressable>
            )}

            {tab === 'builtin' &&
              (builtinEntries.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>
                    No built-in templates for {days} days/week. Try "Show templates for all day counts".
                  </Text>
                </Card>
              ) : (
                builtinEntries.map(([d, templates]) => (
                  <View key={d} style={{ marginBottom: 8 }}>
                    <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      {d} day{d === 1 ? '' : 's'}/week
                    </Text>
                    {templates.map((t) => (
                      <Pressable key={t.id} onPress={() => pickBuiltin(t.id, t.daysPerWeek)}>
                        <Card>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t.name}</Text>
                            <Feather name="chevron-right" size={18} color={colors.text2} />
                          </View>
                        </Card>
                      </Pressable>
                    ))}
                  </View>
                ))
              ))}

            {tab === 'mine' &&
              (loading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
              ) : !mineFiltered.length ? (
                <Card>
                  <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>
                    {userTemplates.length
                      ? `No saved templates for ${days} days/week. Try "Show templates for all day counts".`
                      : "You don't have any saved templates yet. Finish a mesocycle and save it as a template to see it here."}
                  </Text>
                </Card>
              ) : (
                mineFiltered.map((t) => (
                  <Card key={t.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Pressable onPress={() => pickUserTemplate(t)} style={{ flex: 1 }}>
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
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Build a focused split</Text>
                <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 14 }}>Using your {days} days/week from above.</Text>

                <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Priority muscle groups (pick 1-2)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                  {MUSCLE_GROUPS.filter((g) => g.id !== 'core' && g.id !== 'lumbar' && g.id !== 'aductores' && g.id !== 'abductores').map((g) => (
                    <Chip key={g.id} label={g.label} on={focusGroups.includes(g.id)} onPress={() => toggleFocusGroup(g.id)} />
                  ))}
                </View>

                <Pressable onPress={generateFocus} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: colors.accentText, fontWeight: '700' }}>Generate split</Text>
                </Pressable>
              </Card>
            )}
          </FadeIn>
        </>
      )}
    </View>
  );
}
