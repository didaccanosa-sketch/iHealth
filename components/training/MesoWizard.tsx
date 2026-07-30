import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { Card } from '../Card';
import { useAppTheme } from '../../lib/theme-context';
import { radius, spacing } from '../../constants/theme';
import { MuscleGroup, Level, Phase } from '../../lib/engine/types';
import { MUSCLE_GROUPS, analyzeSplit } from '../../lib/engine/workout-engine';
import { EXERCISE_DB } from '../../lib/engine/exercise-db';
import { NewMesoInput } from '../../lib/data/workout';

type WizardDay = { label: string; exercises: { name: string; muscle_group: MuscleGroup; sets: number; reps: string }[] };
type WizardForm = {
  height_cm: string;
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  days: WizardDay[];
};

const PHASES: { id: Phase; label: string }[] = [
  { id: 'volumen', label: 'Volume' },
  { id: 'mantenimiento', label: 'Maintenance' },
  { id: 'definicion', label: 'Cut' },
];
const LEVELS: { id: Level; label: string }[] = [
  { id: 'principiante', label: 'Beginner' },
  { id: 'avanzado', label: 'Advanced' },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: on ? colors.accent : colors.surface2,
        marginRight: 8,
      }}
    >
      <Text style={{ color: on ? colors.accentText : colors.text2, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function MesoWizard({
  initial,
  onCancel,
  onCreate,
}: {
  initial?: NewMesoInput | null;
  onCancel: () => void;
  onCreate: (input: NewMesoInput) => void;
}) {
  const { colors } = useAppTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<WizardForm>(() =>
    initial
      ? {
          height_cm: initial.height_cm != null ? String(initial.height_cm) : '',
          level: initial.level,
          phase: initial.phase,
          duration_weeks: initial.duration_weeks,
          days_per_week: initial.days_per_week,
          days: initial.days,
        }
      : { height_cm: '', level: 'principiante', phase: 'volumen', duration_weeks: 6, days_per_week: 4, days: [] }
  );
  const [dayIdx, setDayIdx] = useState(0);
  const [exGroup, setExGroup] = useState<MuscleGroup | null>(null);
  const [query, setQuery] = useState('');

  function goToDays() {
    if (form.days.length !== form.days_per_week) {
      const days: WizardDay[] = Array.from({ length: form.days_per_week }, (_, i) => ({ label: `Day ${i + 1}`, exercises: [] }));
      setForm((f) => ({ ...f, days }));
    }
    setDayIdx(0);
    setExGroup(null);
    setStep(2);
  }

  function updateDayLabel(label: string) {
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = { ...days[dayIdx], label };
      return { ...f, days };
    });
  }

  function addExercise(name: string) {
    if (!name.trim() || !exGroup) return;
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = {
        ...days[dayIdx],
        exercises: [...days[dayIdx].exercises, { name: name.trim(), muscle_group: exGroup, sets: 3, reps: '8-12' }],
      };
      return { ...f, days };
    });
    setQuery('');
  }

  function removeExercise(i: number) {
    setForm((f) => {
      const days = [...f.days];
      days[dayIdx] = { ...days[dayIdx], exercises: days[dayIdx].exercises.filter((_, idx) => idx !== i) };
      return { ...f, days };
    });
  }

  function updateExercise(i: number, patch: Partial<{ sets: number; reps: string }>) {
    setForm((f) => {
      const days = [...f.days];
      const exercises = [...days[dayIdx].exercises];
      exercises[i] = { ...exercises[i], ...patch };
      days[dayIdx] = { ...days[dayIdx], exercises };
      return { ...f, days };
    });
  }

  const suggestions = useMemo(() => {
    if (!exGroup) return [];
    const list = EXERCISE_DB[exGroup] || [];
    const q = query.trim().toLowerCase();
    return (q ? list.filter((n) => n.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [exGroup, query]);

  const warnings = useMemo(() => (step === 3 ? analyzeSplit(form.days as any, form.phase, form.level) : []), [step, form]);

  const day = form.days[dayIdx];

  return (
    <View>
      <Pressable onPress={onCancel} style={{ marginBottom: 10 }}>
        <Text style={{ color: colors.text2 }}>✕ Cancel</Text>
      </Pressable>

      {step === 1 && (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>New mesocycle — basic info</Text>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Height (cm)</Text>
          <TextInput
            value={form.height_cm}
            onChangeText={(v) => setForm((f) => ({ ...f, height_cm: v }))}
            keyboardType="numeric"
            style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}
          />

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Level</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {LEVELS.map((l) => (
              <Chip key={l.id} label={l.label} on={form.level === l.id} onPress={() => setForm((f) => ({ ...f, level: l.id }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Phase</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {PHASES.map((p) => (
              <Chip key={p.id} label={p.label} on={form.phase === p.id} onPress={() => setForm((f) => ({ ...f, phase: p.id }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Duration (weeks, deload not included)</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {[4, 5, 6, 7, 8].map((n) => (
              <Chip key={n} label={String(n)} on={form.duration_weeks === n} onPress={() => setForm((f) => ({ ...f, duration_weeks: n }))} />
            ))}
          </View>

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Training days per week</Text>
          <TextInput
            value={String(form.days_per_week)}
            onChangeText={(v) => setForm((f) => ({ ...f, days_per_week: parseInt(v) || 1 }))}
            keyboardType="numeric"
            style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 6, borderWidth: 1, borderColor: colors.border }}
          />
          <Text style={{ color: colors.text2, fontSize: 11, marginBottom: 14 }}>
            A deload week (fewer sets, high RIR) is added automatically at the end.
          </Text>

          <Pressable onPress={goToDays} style={{ backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Continue → choose exercises</Text>
          </Pressable>
        </Card>
      )}

      {step === 2 && day && (
        <Card>
          <Text style={{ color: colors.text2, fontSize: 12 }}>
            Day {dayIdx + 1} of {form.days_per_week}
          </Text>
          <TextInput
            value={day.label}
            onChangeText={updateDayLabel}
            style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 4, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 }}
          />

          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 6 }}>Muscle group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {MUSCLE_GROUPS.map((g) => (
              <Chip key={g.id} label={g.label} on={exGroup === g.id} onPress={() => { setExGroup(g.id); setQuery(''); }} />
            ))}
          </ScrollView>

          {exGroup ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search or type an exercise..."
                placeholderTextColor={colors.text2}
                style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
              />
              <View style={{ marginBottom: 12 }}>
                {suggestions.map((s) => (
                  <Pressable key={s} onPress={() => addExercise(s)} style={{ paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.surface2, borderRadius: 12, marginBottom: 5 }}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{s}</Text>
                  </Pressable>
                ))}
                {!!query.trim() && !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
                  <Pressable onPress={() => addExercise(query)} style={{ paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.surface2, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.accent, fontSize: 13 }}>+ Add "{query}" as is</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 12 }}>Pick a muscle group to search exercises</Text>
          )}

          {day.exercises.map((ex, i) => (
            <View key={i} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{ex.name}</Text>
                  <Text style={{ color: colors.text2, fontSize: 11 }}>{MUSCLE_GROUPS.find((g) => g.id === ex.muscle_group)?.label}</Text>
                </View>
                <Pressable onPress={() => removeExercise(i)}>
                  <Text style={{ color: colors.text2, fontSize: 16 }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExercise(i, { sets: parseInt(v) || 1 })}
                  keyboardType="numeric"
                  placeholder="sets"
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, color: colors.text, textAlign: 'center' }}
                />
                <TextInput
                  value={ex.reps}
                  onChangeText={(v) => updateExercise(i, { reps: v })}
                  placeholder="8-12"
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, color: colors.text, textAlign: 'center' }}
                />
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {dayIdx > 0 ? (
              <Pressable onPress={() => { setDayIdx(dayIdx - 1); setExGroup(null); }} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>← Previous day</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setStep(1)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.text2 }}>← Basic info</Text>
              </Pressable>
            )}
            {dayIdx < form.days_per_week - 1 ? (
              <Pressable
                onPress={() => { if (day.exercises.length) { setDayIdx(dayIdx + 1); setExGroup(null); } }}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>Next day →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => { if (day.exercises.length) setStep(3); }}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>Analyze routine</Text>
              </Pressable>
            )}
          </View>
        </Card>
      )}

      {step === 3 && (
        <>
          <Card>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>Routine review</Text>
            {warnings.map((w, i) => (
              <Text key={i} style={{ color: colors.text2, fontSize: 12, marginBottom: 6, lineHeight: 17 }}>
                {w}
              </Text>
            ))}
          </Card>
          {form.days.map((d, i) => (
            <Card key={i}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>{d.label}</Text>
              {d.exercises.map((e, j) => (
                <Text key={j} style={{ color: colors.text2, fontSize: 12, marginBottom: 2 }}>
                  {e.name} — {e.sets}×{e.reps}
                </Text>
              ))}
            </Card>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable onPress={() => setStep(2)} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.text2 }}>← Edit exercises</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                onCreate({
                  height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
                  level: form.level,
                  phase: form.phase,
                  duration_weeks: form.duration_weeks,
                  days_per_week: form.days_per_week,
                  days: form.days,
                })
              }
              style={{ flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: colors.accentText, fontWeight: '700' }}>✅ Create mesocycle</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
